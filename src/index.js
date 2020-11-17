import * as tf from '@tensorflow/tfjs';
import WebcamHandler from './webcam_handler.js';
import GL_IO from './gl_io.js';
import './styles.scss';

let MODEL_INPUT_SHAPE;
let WEBCAM_ACTIVE = false;
let PLAY = false;
let STATS = false;
let MODEL_LOADED = false;
let SHOW_PREPROCESS = false;
let USER_MODEL = {
  json: null,
  weights: null,
};
const MODELS = {
  small: 'models/aurora/model.json',
  medium: 'models/clouds/model.json',
  large: 'models/flowers/model.json',
};

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const timer = document.getElementById('timer');
const upload = document.getElementById('upload');
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
const glio = new GL_IO(gl);
const webcamHandler = new WebcamHandler(video);

/* BUTTONS - 1st ROW */
const buttons_containers = document.getElementsByTagName('buttons');
const buttons = document.getElementsByTagName('button');
buttons[0].addEventListener('click', (e) => {
  buttons[0].classList.toggle('pressed', true);
  buttons[1].classList.toggle('pressed', false);
  overlay.childNodes[1].innerHTML =
    '<strong>Step</strong> to check everything is working, then <strong>Play</strong>';
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
buttons[5].addEventListener('click', function () {
  this.classList.toggle('pressed');
  SHOW_PREPROCESS = !SHOW_PREPROCESS;
});

/* BUTTONS - 2nd ROW */
buttons[6].addEventListener('click', () => loadModel('small'));
buttons[7].addEventListener('click', () => loadModel('medium'));
buttons[8].addEventListener('click', () => loadModel('large'));
buttons[9].addEventListener('click', () => {
  buttons[9].classList.toggle('pressed');
  upload.classList.toggle('hide');
});
const user_load_button = document.getElementById('upload-button');
user_load_button.addEventListener('click', () => {
  if (USER_MODEL.json && USER_MODEL.weights) {
    loadModel('upload');
  } else {
    console.error('Please upload a JSON file and the model weights.');
  }
});

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
const autoPix2Pix = document.getElementById('auto_pix2pix');
const progressContainer = document.getElementById('progress_bar');
const progress = document.querySelector('.percent');

function loadingHandler(f) {
  if (f < 1) {
    let percent = Math.floor(f * 100);
    progress.style.width = `${percent}%`;
    progress.textContent = `${percent}%`;
  }
}

let model;
async function loadModel(modelID = 'med') {
  const start = performance.now();

  playHandler('stop');

  autoPix2Pix.classList.add('hide');
  overlay.childNodes[1].innerText = 'Loading model...';
  progressContainer.classList.toggle('hide', false);

  // Delete old model (as much as possible)
  if (model) {
    disableUI();
    console.log('Releasing memory used by previous model.');
    model.dispose();
    tf.disposeVariables();
  }

  // Upload model
  progress.style.width = '0%';
  progress.textContent = '0%';
  try {
    if (modelID === 'upload') {
      const load = tf.io.browserFiles([USER_MODEL.json, ...USER_MODEL.weights]);
      model = await tf.loadGraphModel(load, {
        strict: true,
        onProgress: (f) => loadingHandler(f),
      });
    } else {
      model = await tf.loadGraphModel(MODELS[modelID], {
        strict: true,
        onProgress: (f) => loadingHandler(f),
      });
    }
  } catch (err) {
    console.error(err);
    return;
  }
  progress.style.width = '100%';
  progress.textContent = '100%';

  MODEL_INPUT_SHAPE = getTensorShape(
    model.artifacts.userDefinedMetadata.signature.inputs
  );

  model.predict(tf.zeros(MODEL_INPUT_SHAPE)).dispose();

  MODEL_LOADED = true;

  if (!webcamHandler.camActive) {
    overlay.childNodes[1].innerHTML =
      '<strong>Init Webcam</strong> to give the model some data.';
  } else {
    overlay.childNodes[1].innerHTML =
      '<strong>Step</strong> to check everything is working, then <strong>Play</strong>';
  }

  allowUI();
  console.log(`MODEL LOADED in ${performance.now() - start}ms`);
}

async function predict(model, pixels) {
  const red = (el, i, arr) => i % 4 === 0;

  const logits = tf.tidy(() => {
    // Take only Red value from RGBA data
    const redChannel = pixels.filter(red);
    const img = tf.tensor(redChannel, [256, 256, 1]).toFloat();

    const offset = tf.scalar(127.5);
    const normalized = img.sub(offset).div(offset);

    const batched = normalized.reshape(MODEL_INPUT_SHAPE);
    return model.predict(batched);
  });

  const output = await postProcessTF(logits);
  const data = await output.data();

  glio.draw(video, data, SHOW_PREPROCESS);

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

/* USER MODEL UPLOAD */
const jsonFileElement = document.getElementById('json-file');
jsonFileElement.addEventListener('change', function (e) {
  let files = e.target.files;
  if (files.length > 1) {
    console.error('There should only be one JSON file.');
    return;
  }
  for (let i = 0, f; (f = files[i]); i++) {
    if (!f.type === 'application/json') {
      console.error('Filetype should be JSON!');
      continue;
    }
  }

  USER_MODEL.json = files[0];
  this.parentElement.classList.add('pressed');

  if (USER_MODEL.weights) {
    user_load_button.classList.add('clickable');
    user_load_button.classList.remove('no-click', 'pressed');
  }
});

const weightsFilesElement = document.getElementById('weights-files');
weightsFilesElement.addEventListener('change', function (e) {
  let files = e.target.files;
  for (let i = 0, f; (f = files[i]); i++) {
    if (!f.type === 'application/octet-stream') {
      console.error('Wrong Weights filetype!');
      continue;
    }
  }
  USER_MODEL.weights = files;
  this.parentElement.classList.add('pressed');

  if (USER_MODEL.json) {
    user_load_button.classList.add('clickable');
    user_load_button.classList.remove('no-click', 'pressed');
  }
});
