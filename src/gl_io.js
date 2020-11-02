import GL_Core from './gl_core.js';
import GL_Program from './gl_program.js';

export default class GL_IO extends GL_Core {
  constructor(gl) {
    super(gl);

    this.blur = new GL_Program(gl, {
      vs_source: `#version 300 es
      in vec4 a_position;
      in vec2 a_texcoord;

      out vec2 v_texcoord;

      void main() {
      gl_Position = a_position;
      v_texcoord = a_texcoord;
      }
      `,

      fs_source: `#version 300 es
      precision highp float;

      uniform sampler2D u_input;
      uniform vec2 u_resolution;
      uniform vec2 u_inputsize;
      uniform float u_kernel[9];
      uniform float u_kernelWeight;

      in vec2 v_texcoord;
      out vec4 outColor;

      float get(vec2 p){
      return texture(u_input, p).r;
      }

      float convolve(vec2 p){
      float sum = 0.0;
      int k=0;
      for(int y=-1; y<1; y++){
      for(int x=-1; x<1; x++){
      sum += get(p + vec2(x, y)/u_inputsize) * u_kernel[k++];
      }
      }
      return sum / u_kernelWeight;
      }

      void main() {
      float c = convolve(v_texcoord) * 1.99;
      outColor = vec4(vec3(c), 1.0);
      //outColor = texture(u_input, v_texcoord);
      }
      `,
      attributes: ['a_position', 'a_texcoord'],
      uniforms: [
        {
          name: 'u_kernel[0]',
          location: null,
          type: 'uniform1fv',
          value: [
            [0.045, 0.122, 0.045, 0.122, 0.332, 0.122, 0.045, 0.122, 0.045],
          ],
        },
        {
          name: 'u_kernelWeight',
          location: null,
          type: 'uniform1f',
          value: [
            this.computeKernelWeight([
              0.045,
              0.122,
              0.045,
              0.122,
              0.332,
              0.122,
              0.045,
              0.122,
              0.045,
            ]),
          ],
        },
      ],
      in: {
        w: 64,
        h: 64,
        d: 1,
      },
      out: {
        w: 64,
        h: 64,
        d: 1,
        offset_x: 0,
        offset_y: 0,
      },
      fbo: true,
    });

    this.upscale = new GL_Program(gl, {
      attributes: ['a_position', 'a_texcoord'],
      in: {
        w: 32,
        h: 32,
        d: 1,
      },
      out: {
        w: 256,
        h: 256,
        d: 1,
        offset_x: 0,
        offset_y: 0,
      },
      fbo: true,
    });

    this.output = new GL_Program(gl, {
      attributes: ['a_position', 'a_texcoord'],
      in: {
        w: 256,
        h: 256,
        d: 3,
      },
      out: {
        w: 512,
        h: 512,
        d: 3,
        offset_x: 512,
        offset_y: 0,
      },
      fbo: false,
    });

    this.pixel_store = new Uint8Array(256 * 256 * 4);

    this.resize();
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

    this.blur.draw(_in);
    this.upscale.draw(this.blur.output);
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

    this.output.draw(this.blur.output, 0, 0);
    this.output.draw(_out, 512, 0);
  }
}
