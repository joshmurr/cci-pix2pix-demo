import * as tf from '@tensorflow/tfjs';
import WebcamHandler from './webcam_handler.js';
import GL_IO from './gl_io.js';
import './styles.scss';

let MODEL_INPUT_SHAPE;
let WEBCAM_ACTIVE = false;
const MODELS = {
  Med_flowers_256_8: 'models/flowers_256_8/model.json',
};

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');
const glio = new GL_IO(gl);
const webcamHandler = new WebcamHandler(video);

const buttons = document.getElementsByTagName('button');
buttons[0].addEventListener('click', (e) => webcamHandler.initCam());
buttons[1].addEventListener('click', (e) => webcamHandler.stopCam());
buttons[2].addEventListener('click', (e) => draw());

async function loadModel(modelID = 'Med_flowers_256_8') {
  let model;
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

  console.log(MODEL_INPUT_SHAPE);

  model.predict(tf.zeros(MODEL_INPUT_SHAPE)).dispose();
  return model;
}

async function predict(imgElement, outputCanvas, gl = false) {
  const logits = tf.tidy(() => {
    const img = tf.browser
      .fromPixels(imgElement, MODEL_INPUT_SHAPE[3])
      .toFloat();

    const offset = tf.scalar(127.5);
    const normalized = img.sub(offset).div(offset);

    const batched = normalized.reshape(MODEL_INPUT_SHAPE);
    return model.predict(batched);
  });

  const output = await postProcessTF(logits);

  if (gl) {
    let data = await output.data();
    outputGL.draw(data);
  } else {
    tf.browser.toPixels(output, outputCanvas);
  }
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

//const model = loadModel(); //.then(() => predict(video, outputCanvas));

function draw() {
  //predict(video, outputCanvas);
  glio.draw(video, video);
}
