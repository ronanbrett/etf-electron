importScripts('./form.umd.js');
onmessage = function (e) {
  console.log(FormBuilder)
  postMessage('hello');
}