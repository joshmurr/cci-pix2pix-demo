import GL_Core from './gl_core.js';

export default class GL_Program extends GL_Core {
  constructor(gl, _opts) {
    super(gl);
    this.opts = {
      vs_source: `#version 300 es
      uniform vec2 u_resolution;

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
       
      in vec2 v_texcoord;
      uniform sampler2D u_input;
      uniform vec2 u_inputsize;
      uniform vec2 u_resolution;
      out vec4 outColor;

      void main() {
        outColor = texture(u_input, v_texcoord);
      }
      `,
      a_position: [-1, -1, -1, 1, 1, -1, -1, 1, 1, 1, 1, -1],
      a_texcoord: [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1],

      attributes: ['a_position'],
      uniforms: [],
      in: {
        w: 32,
        h: 32,
        d: 1, // Num Channels
      },
      out: {
        w: 32,
        h: 32,
        d: 1, // Num Channels
        offset_x: 0,
        offset_y: 0,
      },
    };
    if (_opts) Object.assign(this.opts, _opts);

    const defaultUniforms = [
      {
        name: 'u_input',
        location: null,
        type: 'uniform1i',
        value: [0],
      },
      {
        name: 'u_resolution',
        location: null,
        type: 'uniform2f',
        value: [this.opts.out.w, this.opts.out.h],
      },
      {
        name: 'u_inputsize',
        location: null,
        type: 'uniform2f',
        value: [this.opts.in.w, this.opts.in.h],
      },
    ];

    this.uniforms = defaultUniforms.concat(this.opts.uniforms);

    this.init(this.opts);
  }

  get output() {
    return this.output_texture;
  }

  init(_opts) {
    this.program = this.createProgram(_opts.vs_source, _opts.fs_source);
    /* SETUP ATTRIBUTES & VAO */
    this.attributes = _opts.attributes.map((attr) => {
      return {
        name: attr,
        location: this.gl.getAttribLocation(this.program, attr),
      };
    });

    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);

    this.attributes.forEach((attr) => {
      const buffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        new Float32Array(_opts[attr.name]),
        this.gl.STATIC_DRAW
      );
      this.gl.enableVertexAttribArray(attr.location);
      this.gl.vertexAttribPointer(attr.location, 2, this.gl.FLOAT, false, 0, 0);
    });

    /* SETUP UNIFORMS */
    this.uniforms.forEach((uniform) => {
      uniform.location = this.gl.getUniformLocation(this.program, uniform.name);
    });

    /* SETUP TEXTURES & FBO */
    this.input_texture = this.createTexture({
      width: _opts.in.w,
      height: _opts.in.h,
      ...this.getTextureOpts(_opts.in.d),
    });
    if (_opts.fbo) {
      this.output_texture = this.createTexture({
        width: _opts.out.w,
        height: _opts.out.h,
        filtering: _opts.out.filtering,
        ...this.getTextureOpts(_opts.out.d),
      });
      this.fbo = this.createFramebuffer(this.output_texture);
    }
  }

  draw(_input, _offset_x = 0, _offset_y = 0) {
    this.gl.bindVertexArray(this.vao);
    this.gl.useProgram(this.program);

    this.uniforms.forEach((uniform) => {
      this.gl[uniform.type](uniform.location, ...uniform.value);
    });

    if (_input) {
      if (_input instanceof HTMLElement) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.input_texture);
        this.gl.texImage2D(
          this.gl.TEXTURE_2D,
          0,
          this.gl.R8,
          this.gl.RED,
          this.gl.UNSIGNED_BYTE,
          _input
        );
      } else if (_input instanceof Float32Array) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.input_texture);
        this.gl.texImage2D(
          this.gl.TEXTURE_2D,
          0,
          this.gl.RGB32F,
          this.opts.in.w,
          this.opts.in.h,
          0,
          this.gl.RGB,
          this.gl.FLOAT,
          _input
        );
      } else if (_input instanceof WebGLTexture) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, _input);
      }
    }

    this.gl.viewport(_offset_x, _offset_y, this.opts.out.w, this.opts.out.h);
    this.gl.scissor(_offset_x, _offset_y, this.opts.out.w, this.opts.out.h);

    this.gl.bindFramebuffer(
      this.gl.FRAMEBUFFER,
      this.opts.fbo ? this.fbo : null
    );
    this.gl.drawArrays(this.gl.TRIANGLES, 0, this.opts.a_position.length / 2);
  }
}
