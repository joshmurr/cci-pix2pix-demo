export default class GL_Core {
  constructor(gl) {
    this.gl = gl;
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

  createShader(source, type) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      throw 'Could not compile WebGL program. \n\n' + info;
    }
    return shader;
  }

  createProgram(vsSource, fsSource) {
    const shaderProgram = this.gl.createProgram();
    const vertexShader = this.createShader(vsSource, this.gl.VERTEX_SHADER);
    const fragmentShader = this.createShader(fsSource, this.gl.FRAGMENT_SHADER);
    this.gl.attachShader(shaderProgram, vertexShader);
    this.gl.attachShader(shaderProgram, fragmentShader);
    this.gl.linkProgram(shaderProgram);

    if (this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
      return shaderProgram;
    }

    console.error('Error creating shader program!');
    this.gl.deleteProgram(shaderProgram);
  }

  createTexture(_opts) {
    let opts = {
      internalFormat: 'RGB8',
      format: 'RGB',
      width: 1,
      height: 1,
      dtype: 'UNSIGNED_BYTE',
      filtering: 'NEAREST',
    };
    if (_opts) Object.assign(opts, _opts);

    const texture = this.gl.createTexture();
    this.gl.activeTexture(this.gl.TEXTURE0 + 0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl[opts.internalFormat],
      opts.width,
      opts.height,
      0,
      this.gl[opts.format],
      this.gl[opts.dtype],
      null
    );

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl[opts.filtering]); // prettier-ignore
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl[opts.filtering]); // prettier-ignore
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT); // prettier-ignore
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT); // prettier-ignore

    return texture;
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

  getActiveUniforms(_prog) {
    const numUniforms = this.gl.getProgramParameter(
      _prog,
      this.gl.ACTIVE_UNIFORMS
    );
    let uniforms = [];
    for (let i = 0; i < numUniforms; ++i) {
      const info = this.gl.getActiveUniform(_prog, i);
      uniforms.push(info);
    }
    return uniforms;
  }

  getTextureOpts(_d) {
    switch (_d) {
      case 1:
        return {
          internalFormat: 'R8',
          format: 'RED',
          dtype: 'UNSIGNED_BYTE',
        };
      case 3:
        return {
          internalFormat: 'RGB32F',
          format: 'RGB',
          dtype: 'FLOAT',
        };
    }
  }
}
