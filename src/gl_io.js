import GL_Core from './gl_core.js';
import GL_Program from './gl_program.js';

export default class GL_IO extends GL_Core {
  constructor(gl) {
    super(gl);

    this.process_vs = `#version 300 es
    in vec4 a_position;
    in vec2 a_texcoord;

    out vec2 v_texcoord;

    void main() {
      gl_Position = a_position;
      v_texcoord = a_texcoord;// * vec2(3.0 / 4.0, 1.0);
    }
    `;

    this.process_fs = `#version 300 es
    precision highp float;
     
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform vec2 u_textureSize;
    uniform float u_kernel[50];
    uniform float u_kernelWeight;
    
    const float contrast = (259.0 * (100.0+255.0))/(255.0 * (100.0-128.0));

    in vec2 v_texcoord;
    out vec4 outColor;

    float get(vec2 p){
      return texture(u_texture, p).r;
    }

    //float convolve(vec2 p){
      //float sum = 0.0;
      //sum += get(p + vec2(-1, -1)/256.0) * u_kernel[0];
      //sum += get(p + vec2( 0, -1)/256.0) * u_kernel[1];
      //sum += get(p + vec2( 1, -1)/256.0) * u_kernel[2];
      //sum += get(p + vec2(-1,  0)/256.0) * u_kernel[3];
      //sum += get(p + vec2( 0,  0)/256.0) * u_kernel[4];
      //sum += get(p + vec2( 1,  0)/256.0) * u_kernel[5];
      //sum += get(p + vec2(-1,  1)/256.0) * u_kernel[6];
      //sum += get(p + vec2( 0,  1)/256.0) * u_kernel[7];
      //sum += get(p + vec2( 1,  1)/256.0) * u_kernel[8];
      //return sum / u_kernelWeight;
    //}
    float convolve(vec2 p){
      float sum = 0.0;
      int k=0;
      for(int y=-3; y<3; y++){
        for(int x=-3; x<3; x++){
          sum += get(p + vec2(x, y)/u_resolution) * u_kernel[k++];
        }
      }
      return sum / u_kernelWeight;
    }
          

    void main() {
      //outColor = texture(u_texture, v_texcoord);
      float c = convolve(v_texcoord) * 1.3;
      //c = contrast * (c - 0.5) + 0.5;
      outColor = vec4(vec3(c), 1.0);
    }
    `;

    this.testProg = new GL_Program(gl, {
      vs_source: `#version 300 es
    in vec4 a_position;
    in vec2 a_texcoord;

    out vec2 v_texcoord;

    void main() {
      gl_Position = a_position;
      v_texcoord = a_texcoord;// * vec2(3.0 / 4.0, 1.0);
    }
    `,

      fs_source: `#version 300 es
    precision highp float;
     
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform vec2 u_texturesize;
    uniform float u_kernel[9];
    uniform float u_kernelWeight;

    in vec2 v_texcoord;
    out vec4 outColor;

    float get(vec2 p){
      return texture(u_texture, p).r;
    }

    float convolve(vec2 p){
      float sum = 0.0;
      int k=0;
      for(int y=-1; y<1; y++){
        for(int x=-1; x<1; x++){
          sum += get(p + vec2(x, y)/u_resolution) * u_kernel[k++];
        }
      }
      return sum / u_kernelWeight;
    }
          

    void main() {
      float c = convolve(v_texcoord) * 1.3;
      outColor = vec4(vec3(c), 1.0);
    }
    `,
      attributes: ['a_position', 'a_texcoord'],
      uniforms: [
        {
          name: 'u_kernel[0]',
          location: null,
          type: 'uniform1fv',
          value: [[0, 1, 0, 1, 1, 1, 0, 1, 0]],
        },
        {
          name: 'u_kernelWeight',
          location: null,
          type: 'uniform1f',
          value: [this.computeKernelWeight([0, 1, 0, 1, 1, 1, 0, 1, 0])],
        },
      ],
      in: {
        w: 64,
        h: 64,
        d: 1,
      },
      out: {
        w: 256,
        h: 256,
        d: 1,
      },
    });

    this.output_vs = `#version 300 es
    uniform vec2 u_resolution;

    in vec4 a_position;
    in vec2 a_texcoord;
    out vec2 v_texcoord;

    void main() {
      gl_Position = a_position;
      v_texcoord = a_texcoord * vec2(1.0, -1.0);
    }
    `;

    this.output_fs = `#version 300 es
    precision highp float;
     
    in vec2 v_texcoord;
    uniform sampler2D u_texture;
    uniform vec2 u_textureSize;
    uniform vec2 u_resolution;
    out vec4 outColor;

    void main() {
      outColor = texture(u_texture, v_texcoord);
      //outColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
    `;

    this.verts =      [-1, -1, -1, 1,  1, -1,   -1, 1, 1,  1, 1, -1]; //prettier-ignore
    this.tex_coords = [ 0,  1,  0, 0,  1,  1,    0, 0, 1,  0, 1,  1]; //prettier-ignore

    /* CREATE SHADER PROGRAMS */
    this.process_program = this.createProgram(this.process_vs, this.process_fs);
    this.output_program = this.createProgram(this.output_vs, this.output_fs);

    /* ATTRIBUTE LOCATIONS */
    this.process_posAttrLoc = this.gl.getAttribLocation( this.process_program, 'a_position'); // prettier-ignore
    this.output_posAttrLoc = this.gl.getAttribLocation( this.output_program, 'a_position'); // prettier-ignore
    this.process_texAttrLoc = this.gl.getAttribLocation( this.process_program, 'a_texcoord'); // prettier-ignore
    this.output_texAttrLoc = this.gl.getAttribLocation( this.output_program, 'a_texcoord'); // prettier-ignore

    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);

    /* CREATE BUFFERS */
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(this.verts),
      this.gl.STATIC_DRAW
    );
    this.gl.enableVertexAttribArray(this.process_posAttrLoc);
    this.gl.vertexAttribPointer(this.process_posAttrLoc, 2, this.gl.FLOAT, false, 0, 0); // prettier-ignore
    this.gl.enableVertexAttribArray(this.output_posAttrLoc);
    this.gl.vertexAttribPointer(this.output_posAttrLoc, 2, this.gl.FLOAT, false, 0, 0); // prettier-ignore

    const texBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(this.tex_coords),
      this.gl.STATIC_DRAW
    );
    this.gl.enableVertexAttribArray(this.process_texAttrLoc);
    this.gl.vertexAttribPointer( this.process_texAttrLoc, 2, this.gl.FLOAT, false, 0, 0); // prettier-ignore
    this.gl.enableVertexAttribArray(this.output_texAttrLoc);
    this.gl.vertexAttribPointer( this.output_texAttrLoc, 2, this.gl.FLOAT, false, 0, 0); // prettier-ignore

    /* CREATE TEXTURES AND FBOs TO PROCESS INPUT */
    this.input_texture = this.createTexture({
      internalFormat: 'R8',
      format: 'RED',
    });

    this.process_textures = [];
    this.process_fbos = [];
    for (let i = 0; i < 2; i++) {
      const tex = this.createTexture({
        internalFormat: 'R8',
        format: 'RED',
      });
      const fbo = this.createFramebuffer(tex);

      this.process_textures.push(tex);
      this.process_fbos.push(fbo);
    }

    this.output_texture = this.createTexture({
      internalFormat: 'RGB32F',
      format: 'RGB',
      dtype: 'FLOAT',
    });

    // prettier-ignore
    this.process_uniforms = {
      texture: this.gl.getUniformLocation(this.process_program, 'u_texture'),
      textureSize: this.gl.getUniformLocation(this.process_program, 'u_textureSize'),
      resolution: this.gl.getUniformLocation(this.process_program, 'u_resolution'),
      kernel: this.gl.getUniformLocation(this.process_program, 'u_kernel[0]'),
      kernelWeight: this.gl.getUniformLocation(this.process_program, 'u_kernelWeight'),
    }
    // prettier-ignore
    this.output_uniforms = {
      texture: this.gl.getUniformLocation(this.output_program, 'u_texture'),
      textureSize: this.gl.getUniformLocation( this.output_program, 'u_textureSize'),
      resolution: this.gl.getUniformLocation( this.output_program, 'u_resolution'),
    };

    this.gl.bindVertexArray(null);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

    this.pixel_store = new Uint8Array(256 * 256 * 4);

    // prettier-ignore
    this.process_kernels = {
      //normal: [
        //0, 0, 0,
        //0, 1, 0,
        //0, 0, 0
      //],
      //gaussianBlur: [
        //1, 4, 6, 4, 1,
        //4,16,24,16, 4,
        //6,24,36,24, 6,
        //4,16,24,16, 4,
        //1, 4, 6, 4, 1,
      //],

      gaussianBlur: [
        0.016641, 0.018385, 0.019518, 0.019911, 0.019518, 0.018385, 0.016641,
        0.018385, 0.020312, 0.021564, 0.021998, 0.021564, 0.020312, 0.018385,
        0.019518, 0.021564, 0.022893, 0.023354, 0.022893, 0.021564, 0.019518,
        0.019911, 0.021998, 0.023354, 0.023824, 0.023354, 0.021998, 0.019911,
        0.019518, 0.021564, 0.022893, 0.023354, 0.022893, 0.021564, 0.019518,
        0.018385, 0.020312, 0.021564, 0.021998, 0.021564, 0.020312, 0.018385,
        0.016641, 0.018385, 0.019518, 0.019911, 0.019518, 0.018385, 0.016641,
      ],
      gaussianBlur2: [
        0.016641, 0.018385, 0.019518, 0.019911, 0.019518, 0.018385, 0.016641,
        0.018385, 0.020312, 0.021564, 0.021998, 0.021564, 0.020312, 0.018385,
        0.019518, 0.021564, 0.022893, 0.023354, 0.022893, 0.021564, 0.019518,
        0.019911, 0.021998, 0.023354, 0.023824, 0.023354, 0.021998, 0.019911,
        0.019518, 0.021564, 0.022893, 0.023354, 0.022893, 0.021564, 0.019518,
        0.018385, 0.020312, 0.021564, 0.021998, 0.021564, 0.020312, 0.018385,
        0.016641, 0.018385, 0.019518, 0.019911, 0.019518, 0.018385, 0.016641,
      ]

      //gaussianBlur: [
      //0.039206, 0.039798, 0.039997, 0.039798, 0.039206,
      //0.039798, 0.040399, 0.040601, 0.040399, 0.039798,
      //0.039997, 0.040601, 0.040804, 0.040601, 0.039997,
      //0.039798, 0.040399, 0.040601, 0.040399, 0.039798,
      //0.039206, 0.039798, 0.039997, 0.039798, 0.039206,
      //],
      //gaussianBlur2: [
        //0.003765, 0.015019, 0.023792, 0.015019, 0.003765, 
        //0.015019, 0.059912, 0.094907, 0.059912, 0.015019,
        //0.023792, 0.094907, 0.150342, 0.094907, 0.023792,
        //0.015019, 0.059912, 0.094907, 0.059912, 0.015019,
        //0.003765, 0.015019, 0.023792, 0.015019, 0.003765,
      //],
      //gaussianBlur2: [
        //1, 4, 6, 4, 1,
        //4,16,24,16, 4,
        //6,24,36,24, 6,
        //4,16,24,16, 4,
        //1, 4, 6, 4, 1,
      //],
      //gaussianBlur3: [
        //1, 4, 6, 4, 1,
        //4,16,24,16, 4,
        //6,24,36,24, 6,
        //4,16,24,16, 4,
        //1, 4, 6, 4, 1,
      //]
      //gaussianBlur: [
        //0.045, 0.122, 0.045,
        //0.122, 0.332, 0.122,
        //0.045, 0.122, 0.045
      //],
      //gaussianBlur2: [
        //1, 2, 1,
        //2, 4, 2,
        //1, 2, 1
      //],
      //gaussianBlur3: [
        //0, 1, 0,
        //1, 1, 1,
        //0, 1, 0
      //],
    }

    this.resize();

    this.count = 1;
  }

  computeKernelWeight(kernel) {
    const weight = kernel.reduce((prev, curr) => prev + curr);
    return weight < 0 ? 1 : weight;
  }

  get pixels() {
    return this.pixel_store;
  }

  draw(_in, _out) {
    this.gl.enable(this.gl.SCISSOR_TEST);

    this.gl.bindVertexArray(this.vao);

    //let i = 0;
    /* PRE-PROCESS INPUT */
    // Load webcam into first texture
    this.gl.useProgram(this.process_program);
    this.gl.uniform1i(this.process_uniforms.texture, 0);
    //this.gl.activeTexture(this.gl.TEXTURE0 + 0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.input_texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R8,
      this.gl.RED,
      this.gl.UNSIGNED_BYTE,
      _in
    );

    this.gl.viewport(0, 0, 256, 256);
    this.gl.scissor(0, 0, 256, 256);
    this.gl.uniform2f(this.process_uniforms.textureSize, 256, 256);
    this.gl.uniform2f(this.process_uniforms.resolution, 256, 256);

    let i = 0;
    //prettier-ignore
    for (const kernelName in this.process_kernels) {
      // Ping-pong input between two fbo's to preprocess
      const kernel = this.process_kernels[kernelName];
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.process_fbos[i % 2]);
     
      this.gl.uniform1fv(this.process_uniforms.kernel, kernel);
      this.gl.uniform1f(this.process_uniforms.kernelWeight, this.computeKernelWeight(kernel));
      this.gl.drawArrays(this.gl.TRIANGLES, 0, this.verts.length / 2);

      this.gl.bindTexture(this.gl.TEXTURE_2D, this.process_textures[i % 2]);
      //this.count++;
      ++i;
    }

    /* SAVE PROCESSED INPUT INTO this.pixel_store */
    this.gl.readPixels(
      0,
      0,
      256,
      256,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      this.pixel_store
    );

    /* RENDER INPUT */
    this.gl.useProgram(this.output_program);
    this.gl.uniform1i(this.output_uniforms.texture, 0);
    this.gl.uniform2f(this.output_uniforms.textureSize, 256, 256);
    this.gl.uniform2f(this.output_uniforms.resolution, 256, 256);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, this.gl.canvas.width / 2, this.gl.canvas.height);
    this.gl.scissor(0, 0, this.gl.canvas.width / 2, this.gl.canvas.height);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, this.verts.length / 2);

    /* RENDER OUTPUT */
    //this.gl.bindTexture(this.gl.TEXTURE_2D, this.output_texture);

    this.testProg.draw(_in);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.testProg.output);
    this.gl.viewport(
      this.gl.canvas.width / 2,
      0,
      this.gl.canvas.width / 2,
      this.gl.canvas.height
    );
    this.gl.scissor(
      this.gl.canvas.width / 2,
      0,
      this.gl.canvas.width / 2,
      this.gl.canvas.height
    );
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGB32F,
      256,
      256,
      0,
      this.gl.RGB,
      this.gl.FLOAT,
      _out
    );
    this.gl.drawArrays(this.gl.TRIANGLES, 0, this.verts.length / 2);
  }
}
