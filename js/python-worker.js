// Runs Python programs for the «Запустить» buttons of the lessons (see addPythonRunners() in js/site.js).
// Pyodide, CPython compiled to WebAssembly, is loaded from jsDelivr when the first program is started, so a
// lesson costs nothing until a reader runs a program. The program runs here, not on the page, so an endless
// loop can be stopped by terminating this worker. Pyodide 314 needs a module worker: site.js creates this file
// with { type: 'module' }, because a classic worker (importScripts) cannot load pyodide.js.
import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs';

// Pyodide loads once per worker; the page hears of it with 'ready', so it can tell an error of a program from a
// failed start. A failure is kept and not retried here: the next run reports it with reload: true, and the page
// then replaces this worker with a new one, which tries again.
let pyodide = null;
let loadFailure = null;
const loading = loadPyodide().then(
  (loaded) => {
    pyodide = loaded;
    self.postMessage({ type: 'ready' });
  },
  (error) => {
    loadFailure = error;
  },
);

// The last character shown in the current run, of either stream: the page shows both in one place, in this order,
// and the name of an output file must start on its own line (postFiles).
let lastShown = '\n';

// Programs run one after another, so the output of two runs never mixes.
let queue = Promise.resolve();
self.onmessage = (event) => {
  queue = queue.then(() => runProgram(event.data));
};

// The reason a start failed, as one sentence in Russian. Pyodide rejects with an ExitStatus object, which is not an
// Error, so String() would show [object Object].
function describe(error) {
  let reason = 'неизвестная ошибка';
  if (error instanceof Error) reason = String(error);
  else if (typeof error?.message === 'string') reason = error.message;
  return `Не удалось загрузить Python: ${reason}. Обычно причина в сети: перезагрузите страницу и попробуйте снова.`;
}

// The files a program opens by a literal name, found in its code: open('sum.in'), open("sum.out", "w"),
// open('x', 'r', encoding='utf-8'), open('log', mode='a'). A mode with w or a makes an output file; every other
// name is an input file. Only a literal name without a slash is found: a name built at run time, such as
// open(sys.argv[1]), open(name) or open(f'{task}.in'), and a path stay unknown, so the program finds no such file.
const OPEN_CALL = /\bopen\s*\(\s*(['"])([^'"\\/\n]+)\1\s*(?:,\s*(?:mode\s*=\s*)?(['"])([^'"\n]*)\3)?/g;

function fileNames(code) {
  const names = { input: new Set(), output: new Set() };
  for (const [, , name, , mode = ''] of code.matchAll(OPEN_CALL)) {
    (/[wa]/.test(mode) ? names.output : names.input).add(name);
  }
  return names;
}

// Python code run after the program. Its streams are flushed, so a file it made sys.stdout holds all it printed,
// and the standard streams are put back, or the next run would print into that file.
const END_OF_RUN = `
import sys
for stream in (sys.stdout, sys.stderr, sys.__stdout__, sys.__stderr__):
    try:
        stream.flush()
    except Exception:
        pass
sys.stdin, sys.stdout, sys.stderr = sys.__stdin__, sys.__stdout__, sys.__stderr__
`;

// input() takes one line of the input box per call; past the last line it reports the end of the input. The same
// text is the content of every file the program reads, and every file it writes is shown after the run.
async function runProgram({ code, input }) {
  await loading;
  if (!pyodide) {
    self.postMessage({ type: 'end', error: describe(loadFailure), reload: true });
    return;
  }
  const lines = input ? input.replace(/\n$/, '').split('\n') : [];
  lastShown = '\n';
  const decoders = { out: new TextDecoder(), err: new TextDecoder() };
  pyodide.setStdout(outputWriter('out', decoders.out));
  pyodide.setStderr(outputWriter('err', decoders.err));
  pyodide.setStdin({ stdin: () => lines.shift() });
  const files = fileNames(code);
  writeFiles(files.input, input);
  // A new namespace for every run, so a variable from an earlier run cannot change the result. The program runs
  // as __main__, so the blocks "if __name__ == '__main__':" run.
  const globals = pyodide.toPy({ __name__: '__main__' });
  let error = null;
  try {
    await pyodide.runPythonAsync(code, { globals });
  } catch (failure) {
    error = String(failure);
  }
  flushOutput(decoders);
  dropNamespace(globals);
  postFiles(files.output);
  removeFiles([...files.input, ...files.output]);
  self.postMessage({ type: 'end', error });
}

// The namespace of the run is emptied the way CPython empties __main__ at exit: every object of the program is
// released by its reference count, so a file the program left open is closed, which writes what it still held.
// Collecting the garbage would not do: a function of the program keeps the namespace in a reference cycle, and
// the objects of an open file in a collected cycle drop their text (CPython behaviour, the same on a desktop).
function dropNamespace(globals) {
  globals.clear();
  globals.destroy();
}

// Python's output comes as bytes, as it is written, with or without a final newline. A write can end in the middle
// of a multi-byte character, so each stream decodes with its own streaming decoder, which keeps the cut character
// until the next write.
function outputWriter(type, decoder) {
  return {
    write(bytes) {
      postText(type, decoder.decode(bytes, { stream: true }));
      return bytes.length;
    },
  };
}

// Nothing stays in a buffer for the next run: Python's streams are flushed and put back (END_OF_RUN), then the
// decoders give up what they hold.
function flushOutput(decoders) {
  try {
    pyodide.runPython(END_OF_RUN);
  } catch {
    // The interpreter itself is broken, for example sys was replaced: nothing more can be flushed.
  }
  for (const [type, decoder] of Object.entries(decoders)) postText(type, decoder.decode());
}

// The input box is the text of every file the program reads. A name that cannot be written, such as "..", is left
// to the program's own open(), which reports it.
function writeFiles(names, text) {
  for (const name of names) {
    try {
      pyodide.FS.writeFile(name, text);
    } catch {
      // reported by the program's own open()
    }
  }
}

// Every output file the program wrote is shown after a line with its name, so the reader sees where the text came
// from. The name starts on its own line also when the output before it lacked a final newline.
function postFiles(names) {
  for (const name of names) {
    const text = readFile(name);
    if (text === null) continue;
    const newline = lastShown === '\n' ? '' : '\n';
    postText('out', `${newline}--- ${name} ---\n${text}`);
  }
}

function readFile(name) {
  try {
    return pyodide.FS.readFile(name, { encoding: 'utf8' });
  } catch {
    return null; // the program did not write it
  }
}

// The files of a run are removed after it, so the next run starts without them.
function removeFiles(names) {
  for (const name of names) {
    try {
      pyodide.FS.unlink(name);
    } catch {
      // never written
    }
  }
}

function postText(type, text) {
  if (!text) return;
  lastShown = text.at(-1);
  self.postMessage({ type, text });
}
