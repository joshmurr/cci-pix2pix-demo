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
        v_texcoord = a_texcoord * vec2(1.0, -1.0);
      }
      `,

      fs_source: `#version 300 es
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
      },
    };
    if (_opts) Object.assign(this.opts, _opts);

    const defaultUniforms = [
      {
        name: 'u_resolution',
        location: null,
        type: 'uniform2f',
        value: [this.opts.out.w, this.opts.out.h],
      },
      {
        name: 'u_texturesize',
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
    this.input_texture = this.createTexture(this.getTextureOpts(_opts.in.d));
    this.output_texture = this.createTexture(this.getTextureOpts(_opts.out.d));
    this.fbo = this.createFramebuffer(this.output_texture);
  }

  draw(_input) {
    this.gl.bindVertexArray(this.vao);
    this.gl.useProgram(this.program);

    for (const u in this.uniforms) {
      const uniform = this.uniforms[u];
      this.gl[uniform.type](uniform.location, ...uniform.value);
    }

    this.gl.viewport(0, 0, this.opts.out.w, this.opts.out.h);
    if (_input) {
      if (_input instanceof HTMLElement) {
        // Update
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.input_texture);
        this.gl.texImage2D(
          this.gl.TEXTURE_2D,
          0,
          this.gl.R8,
          this.gl.RED,
          this.gl.UNSIGNED_BYTE,
          _input
        );
      } else if (_input instanceof WebGLTexture) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, _input);
      }
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, this.opts.a_position.length / 2);
  }

  updateTexture(_tex, _data) {
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R8,
      this.gl.RED,
      this.gl.UNSIGNED_BYTE,
      _data
    );
  }

  getTextureOpts(_d) {
    switch (_d) {
      case 1:
        return {
          internalFormat: 'R8',
          format: 'RED',
          dtype: 'UNSIGNED_BYTE',
        };
      case 2:
        return {
          internalFormat: 'RGB32F',
          format: 'RGB',
          dtype: 'FLOAT',
        };
    }
  }
}
