export default class GL_IO {
  constructor(gl) {
    this.gl = gl;

    if (!this.gl) {
      console.error('No WebGL2 support in your chosen browser!');
    }

    this.input_vs = `#version 300 es
    in vec4 a_position;
    in vec2 a_texcoord;

    out vec2 v_texcoord;

    void main() {
      gl_Position = a_position;
      v_texcoord = a_texcoord * vec2(3.0 / 4.0, 1.0);
    }
    `;

    this.input_fs = `#version 300 es
    precision highp float;
     
    in vec2 v_texcoord;
    uniform sampler2D u_texture;
    out vec4 outColor;

    const float res = 512.0;

    float get(vec2 p){
      return texture(u_texture, p).r;
    }

    float avgpool(vec2 p){
      float avg = 0.0;
      for(int y=-1; y<=1; ++y){
        for(int x=-1; x<=1; ++x){
          avg += get(p + vec2(x, y)/res);
        }
      }
      return avg / 9.0;
    }
          

    void main() {
      //outColor = texture(u_texture, v_texcoord);
      outColor = vec4(vec3(avgpool(v_texcoord)), 1.0);
    }
    `;

    this.output_vs = `#version 300 es
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
    out vec4 outColor;

    void main() {
      outColor = texture(u_texture, v_texcoord);
      //outColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
    `;

    this.verts =      [-1, -1, -1, 1,  1, -1,   -1, 1, 1,  1, 1, -1]; //prettier-ignore
    this.tex_coords = [ 0,  1,  0, 0,  1,  1,    0, 0, 1,  0, 1,  1]; //prettier-ignore

    /* CREATE SHADER PROGRAMS */
    this.input_program = this.createProgram(
      this.gl,
      this.input_vs,
      this.input_fs
    );
    this.output_program = this.createProgram(
      this.gl,
      this.output_vs,
      this.output_fs
    );

    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);

    /* ATTRIBUTE LOCATIONS */
    this.input_posAttrLoc = this.gl.getAttribLocation(
      this.input_program,
      'a_position'
    );
    this.output_posAttrLoc = this.gl.getAttribLocation(
      this.output_program,
      'a_position'
    );
    this.input_texAttrLoc = this.gl.getAttribLocation(
      this.input_program,
      'a_texcoord'
    );
    this.output_texAttrLoc = this.gl.getAttribLocation(
      this.output_program,
      'a_texcoord'
    );

    /* CREATE BUFFERS */
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(this.verts),
      this.gl.STATIC_DRAW
    );
    this.gl.enableVertexAttribArray(this.input_posAttrLoc);
    this.gl.vertexAttribPointer(
      this.input_posAttrLoc,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );
    this.gl.enableVertexAttribArray(this.output_posAttrLoc);
    this.gl.vertexAttribPointer(
      this.output_posAttrLoc,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    const texBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(this.tex_coords),
      this.gl.STATIC_DRAW
    );
    this.gl.enableVertexAttribArray(this.input_texAttrLoc);
    this.gl.vertexAttribPointer(
      this.input_texAttrLoc,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );
    this.gl.enableVertexAttribArray(this.output_texAttrLoc);
    this.gl.vertexAttribPointer(
      this.output_texAttrLoc,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    this.input_texture = this.createInputTexture();
    this.process_texture = this.createOutputTexture();
    this.output_texture = this.createOutputTexture();
    this.framebuffer = this.createFramebuffer(this.process_texture);

    this.u_input_tex = this.gl.getUniformLocation(
      this.input_program,
      'u_texture'
    );
    this.u_output_tex = this.gl.getUniformLocation(
      this.output_program,
      'u_texture'
    );

    this.gl.bindVertexArray(null);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

    this.pixel_store = new Uint8Array(256 * 256 * 4);

    this.resize();
  }

  createFramebuffer(_tex) {
    const fb = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      _tex,
      0
    );
    return fb;
  }

  createShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      throw 'Could not compile WebGL program. \n\n' + info;
    }
    return shader;
  }

  createProgram(gl, vsSource, fsSource) {
    const shaderProgram = gl.createProgram();
    const vertexShader = this.createShader(this.gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = this.createShader(
      this.gl,
      fsSource,
      gl.FRAGMENT_SHADER
    );
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      return shaderProgram;
    }

    console.error('Error creating shader program!');
    gl.deleteProgram(shaderProgram);
  }

  createInputTexture() {
    // Texture
    const texture = this.gl.createTexture();
    this.gl.activeTexture(this.gl.TEXTURE0 + 0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R8,
      256,
      256,
      0,
      this.gl.RED,
      this.gl.UNSIGNED_BYTE,
      null
    );

    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.NEAREST
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.NEAREST
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.REPEAT
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.REPEAT
    );

    return texture;
  }

  createOutputTexture() {
    // Texture
    const texture = this.gl.createTexture();
    this.gl.activeTexture(this.gl.TEXTURE0 + 0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGB8,
      256,
      256,
      0,
      this.gl.RGB,
      this.gl.UNSIGNED_BYTE,
      null
    );

    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.NEAREST
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.NEAREST
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.REPEAT
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.REPEAT
    );

    return texture;
  }

  deleteTexture() {
    this.gl.deleteTexture(this.input_texture);
    this.gl.deleteTexture(this.output_texture);
  }

  resize() {
    // https://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
    var realToCSSPixels = window.devicePixelRatio;

    var displayWidth = Math.floor(this.gl.canvas.clientWidth * realToCSSPixels);
    var displayHeight = Math.floor(
      this.gl.canvas.clientHeight * realToCSSPixels
    );

    if (
      this.gl.canvas.width !== displayWidth ||
      this.gl.canvas.height !== displayHeight
    ) {
      this.gl.canvas.width = displayWidth;
      this.gl.canvas.height = displayHeight;
    }
  }

  get pixels() {
    return this.pixel_store;
  }

  draw(_in, _out) {
    this.gl.bindVertexArray(this.vao);

    /* PRE-PROCESS INPUT AND DRAW INTO FRAMEBUFFER */
    this.gl.useProgram(this.input_program);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.uniform1i(this.u_input_tex, 0);
    this.gl.activeTexture(this.gl.TEXTURE0 + 0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.input_texture);
    this.gl.enable(this.gl.SCISSOR_TEST);
    this.gl.viewport(0, 0, 256, 256);
    this.gl.scissor(0, 0, 256, 256);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R8,
      this.gl.RED,
      this.gl.UNSIGNED_BYTE,
      _in
    );
    this.gl.drawArrays(this.gl.TRIANGLES, 0, this.verts.length / 2);
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
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, this.gl.canvas.width / 2, this.gl.canvas.height);
    this.gl.scissor(0, 0, this.gl.canvas.width / 2, this.gl.canvas.height);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, this.verts.length / 2);

    /* RENDER OUTPUT */
    this.gl.useProgram(this.output_program);
    this.gl.uniform1i(this.u_output_tex, 0);
    this.gl.activeTexture(this.gl.TEXTURE0 + 0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.output_texture);
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
