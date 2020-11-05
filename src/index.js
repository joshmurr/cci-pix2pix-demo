import * as tf from '@tensorflow/tfjs';
import WebcamHandler from './webcam_handler.js';
import GL_IO from './gl_io.js';
import './styles.scss';

let MODEL_INPUT_SHAPE;
let WEBCAM_ACTIVE = false;
let PLAY = false;
let STATS = false;
let MODEL_LOADED = false;
const MODELS = {
  small: 'models/clouds_256_4/model.json',
  medium: 'models/flowers_256_8/model.json',
  large: 'models/greyscale2flowers/uncompressed/model.json',
};

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const timer = document.getElementById('timer');
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
const glio = new GL_IO(gl);
const webcamHandler = new WebcamHandler(video);

/* BUTTONS */
const buttons_containers = document.getElementsByTagName('buttons');
const buttons = document.getElementsByTagName('button');
buttons[0].addEventListener('click', (e) => {
  buttons[0].classList.toggle('pressed', true);
  buttons[1].classList.toggle('pressed', false);
  webcamHandler.initCam();
});
buttons[1].addEventListener('click', (e) => {
  buttons[0].classList.toggle('pressed', false);
  buttons[1].classList.toggle('pressed', true);
  webcamHandler.stopCam();
  playHandler('stop');
});
buttons[2].addEventListener('click', () => {
  overlay.classList.add('hide');
  draw();
});
buttons[3].addEventListener('click', playHandler);
buttons[4].addEventListener('click', statsHandler);

buttons[5].addEventListener('click', () => loadModel('small'));
buttons[6].addEventListener('click', () => loadModel('medium'));
buttons[7].addEventListener('click', () => loadModel('large'));

function playHandler(_val) {
  PLAY = _val === 'stop' ? false : !PLAY;
  if (PLAY && video.srcObject) {
    overlay.classList.add('hide');
    buttons[3].innerText = 'Stop';
    buttons[3].classList.add('pressed');
    if (STATS) requestAnimationFrame(drawWithStats);
    else requestAnimationFrame(draw);
  } else {
    buttons[3].innerText = 'Play';
    buttons[3].classList.remove('pressed');
    tf.disposeVariables();
  }
}

/* STATS */
const step_time = document.getElementById('step_time');
const avg_time = document.getElementById('avg_time');
const fps = document.getElementById('fps');
let time_bank = new Float32Array(10);
let time_counter = 0;

function statsHandler() {
  STATS = !STATS;
  buttons[4].classList.toggle('pressed');
  let table = document.getElementsByTagName('table')[0];
  table.classList.toggle('hide');
}

/* OVERLAY */
const overlay = document.getElementById('overlay');

let model;
async function loadModel(modelID = 'med') {
  overlay.childNodes[1].innerText = 'Loading model...';

  if (model) {
    disableUI();
    console.log('Releasing memory used by previous model.');
    model.dispose();
    tf.disposeVariables();
  }

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

  MODEL_LOADED = true;

  if (!webcamHandler.camActive) {
    overlay.childNodes[1].innerText =
      'Init Webcam to give the model some data.';
  } else {
    overlay.classList.add('hide');
  }

  allowUI();
  console.log('MODEL LOADED');
}

async function predict(model, pixels) {
  // Take only Red value from RGBA data
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

  output.dispose();
  logits.dispose();
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
        const input_shape = _data[item][input]['dim'];
        for (const d in input_shape) {
          shape.push(Math.abs(input_shape[d]['size']));
        }
      }
    }
  }
  return shape;
}

function allowUI() {
  for (const n in buttons) {
    const button = buttons[n];
    if (button instanceof HTMLElement) {
      button.classList.remove('no-click');
      button.classList.add('clickable');
    }
  }
}

function disableUI() {
  overlay.classList.remove('hide');
  for (const n in buttons) {
    const button = buttons[n];
    if (button instanceof HTMLElement) {
      button.classList.add('no-click');
      button.classList.remove('clickable');
    }
  }
}

function draw() {
  predict(model, glio.pixels);
  if (PLAY) {
    if (STATS) requestAnimationFrame(drawWithStats);
    else requestAnimationFrame(draw);
  }
}

function drawWithStats() {
  const start = performance.now();
  predict(model, glio.pixels);
  const time = performance.now() - start;
  step_time.innerText = Math.round((time_bank[time_counter++ % 10] = time));

  if (time_counter % 10 === 0) {
    const time_for_ten = time_bank.reduce((prev, curr) => prev + curr);
    avg_time.innerText = Math.round(time_for_ten / 10);
    fps.innerText = Math.floor((10 / time_for_ten) * 1000);
  }

  if (PLAY) {
    if (STATS) requestAnimationFrame(drawWithStats);
    else requestAnimationFrame(draw);
  }
}
