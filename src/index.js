import * as tf from '@tensorflow/tfjs';
import WebcamHandler from './webcam_handler.js';
import GL_IO from './gl_io.js';
import './styles.scss';

let MODEL_INPUT_SHAPE;
let WEBCAM_ACTIVE = false;
let PLAY = false;
const MODELS = {
  med: 'models/flowers_256_8/model.json',
  big: 'models/greyscale2flowers/uncompressed/model.json',
};

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const timer = document.getElementById('timer');
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
const glio = new GL_IO(gl);
const webcamHandler = new WebcamHandler(video);

const buttons = document.getElementsByTagName('button');
buttons[0].addEventListener('click', (e) => webcamHandler.initCam());
buttons[1].addEventListener('click', (e) => {
  PLAY = false;
  webcamHandler.stopCam();
});
buttons[2].addEventListener('click', (e) => draw());
buttons[3].addEventListener('click', (e) => {
  PLAY = !PLAY;
  if (PLAY) {
    buttons[3].innerText = 'Stop';
    draw();
  } else {
    buttons[3].innerText = 'Play';
  }
});

let model;
async function loadModel(modelID = 'med') {
  try {
    if (modelID === 'User Upload') {
      const load = tf.io.browserFiles([userModel.json, ...userModel.weights]);
      model = await tf.loadGraphModel(load, { strict: true });
    } else {
      model = await tf.loadGraphModel(MODELS[modelID], { strict: true });
    }
  } catch (err) {
    console.log(err);
    return;
  }
  MODEL_INPUT_SHAPE = getTensorShape(
    model.artifacts.userDefinedMetadata.signature.inputs
  );

  model.predict(tf.zeros(MODEL_INPUT_SHAPE)).dispose();
}

async function predict(model, pixels) {
  const red = (el, i, arr) => i % 4 === 0;

  const logits = tf.tidy(() => {
    const redChannel = pixels.filter(red);
    const img = tf.tensor(redChannel, [256, 256, 1]).toFloat();

    const offset = tf.scalar(127.5);
    const normalized = img.sub(offset).div(offset);

    const batched = normalized.reshape(MODEL_INPUT_SHAPE);
    return model.predict(batched);
  });

  const output = await postProcessTF(logits);
  const data = await output.data();

  glio.draw(video, data);
}

async function postProcessTF(logits) {
  return tf.tidy(() => {
    const scale = tf.scalar(0.5);
    const squeezed = logits.squeeze().mul(scale).add(scale);
    const resized = tf.image.resizeBilinear(squeezed, [256, 256]);
    return resized;
  });
}

function getTensorShape(_data) {
  let shape = [];
  for (const item in _data) {
    for (const input in _data[item]) {
      if (input === 'tensorShape') {
        let input_shape = _data[item][input]['dim'];
        for (const d in input_shape) {
          shape.push(Math.abs(input_shape[d]['size']));
        }
      }
    }
  }
  return shape;
}

function draw() {
  const start = performance.now();
  predict(model, glio.pixels);
  timer.innerText = performance.now() - start;
  if (PLAY) {
    requestAnimationFrame(draw);
  }
}

loadModel('big');
