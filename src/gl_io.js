import GL_Core from './gl_core.js';
import GL_Program from './gl_program.js';

const blur_vs = `#version 300 es
      in vec4 a_position;
      in vec2 a_texcoord;

      out vec2 v_texcoord;

      void main() {
      gl_Position = a_position;
      v_texcoord = a_texcoord;
      }
      `;

const blur_fs = `#version 300 es
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
      float c = convolve(v_texcoord) * 2.2;
      outColor = vec4(vec3(c), 1.0);
      //outColor = texture(u_input, v_texcoord);
      }
      `;

const gaussian1 = [ 0.045, 0.122, 0.045, 0.122, 0.332, 0.122, 0.045, 0.122, 0.045, ]; //prettier-ignore
const gaussian2 = [1, 2, 1, 2, 4, 2, 1, 2, 1];
const gaussian3 = [0, 1, 0, 1, 1, 1, 0, 1, 0];
const CONTRAST = 10;

export default class GL_IO extends GL_Core {
  constructor(gl) {
    super(gl);

    this.blur1 = new GL_Program(gl, {
      vs_source: blur_vs,
      fs_source: blur_fs,
      attributes: ['a_position', 'a_texcoord'],
      uniforms: [
        {
          name: 'u_kernel[0]',
          location: null,
          type: 'uniform1fv',
          value: [gaussian1],
        },
        {
          name: 'u_kernelWeight',
          location: null,
          type: 'uniform1f',
          value: [this.computeKernelWeight(gaussian1)],
        },
      ],
      in: {
        w: 16,
        h: 16,
        d: 1,
      },
      out: {
        w: 16,
        h: 16,
        d: 1,
        filtering: 'LINEAR',
        offset_x: 0,
        offset_y: 0,
      },
      fbo: true,
    });

    this.blur2 = new GL_Program(gl, {
      vs_source: blur_vs,
      fs_source: blur_fs,
      attributes: ['a_position', 'a_texcoord'],
      uniforms: [
        {
          name: 'u_kernel[0]',
          location: null,
          type: 'uniform1fv',
          value: [gaussian2],
        },
        {
          name: 'u_kernelWeight',
          location: null,
          type: 'uniform1f',
          value: [this.computeKernelWeight(gaussian2)],
        },
      ],
      in: {
        w: 16,
        h: 16,
        d: 1,
      },
      out: {
        w: 16,
        h: 16,
        d: 1,
        filtering: 'LINEAR',
        offset_x: 0,
        offset_y: 0,
      },
      fbo: true,
    });

    this.blur3 = new GL_Program(gl, {
      vs_source: blur_vs,
      fs_source: blur_fs,
      attributes: ['a_position', 'a_texcoord'],
      uniforms: [
        {
          name: 'u_kernel[0]',
          location: null,
          type: 'uniform1fv',
          value: [gaussian3],
        },
        {
          name: 'u_kernelWeight',
          location: null,
          type: 'uniform1f',
          value: [this.computeKernelWeight(gaussian3)],
        },
      ],
      in: {
        w: 16,
        h: 16,
        d: 1,
      },
      out: {
        w: 16,
        h: 16,
        d: 1,
        filtering: 'LINEAR',
        offset_x: 0,
        offset_y: 0,
      },
      fbo: true,
    });

    this.upscale = new GL_Program(gl, {
      fs_source: `#version 300 es
      precision highp float;
       
      in vec2 v_texcoord;
      uniform sampler2D u_input;
      uniform vec2 u_inputsize;
      uniform vec2 u_resolution;
      uniform float u_factor;
      out vec4 outColor;

      float contrast(float v){
        return u_factor*(v-0.5) + 0.5;      
      }

      void main() {
        outColor = texture(u_input, v_texcoord) * 1.7;
        outColor.r = contrast(outColor.r);
      }
      `,
      attributes: ['a_position', 'a_texcoord'],
      uniforms: [
        {
          name: 'u_factor',
          location: null,
          type: 'uniform1f',
          value: [(259 * (255 + CONTRAST)) / (255 * (259 - CONTRAST))],
        },
      ],
      in: {
        w: 32,
        h: 32,
        d: 1,
      },
      out: {
        w: 256,
        h: 256,
        d: 1,
        filtering: 'LINEAR',
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

    //this.resize();
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

    /* PREPROCESS PIPELINE */
    this.blur1.draw(_in);
    this.blur2.draw(this.blur1.output);
    this.blur3.draw(this.blur2.output);
    this.upscale.draw(this.blur3.output);

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

    /* RENDER OUTPUT FROM MODEL */
    this.output.draw(_in, 0, 0);
    this.output.draw(_out, 512, 0);
  }
}
