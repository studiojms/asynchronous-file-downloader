const { Buffer } = require('buffer');
const { Readable } = require('stream');
const EventEmitter = require('events');
const { AbortController } = require('abort-controller');
const createController = require('.');

jest.setTimeout(2000);

const textBuffer = Buffer.alloc(797, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis vitae efficitur enim, et sollicitudin risus. Vestibulum maximus odio eu arcu gravida, at dictum nisi consectetur. Etiam aliquam dignissim purus ac finibus. Maecenas ac lorem sed sapien viverra sagittis. Aliquam tempus est in varius scelerisque. Curabitur eu mauris varius, semper tellus ac, ultrices quam. Ut tincidunt non ligula id blandit. Nulla sit amet augue dapibus, consectetur lacus laoreet, elementum ex. Nam placerat arcu magna, id malesuada ipsum tincidunt ut. Maecenas ex mauris, imperdiet a facilisis ac, tempor ut eros. Aliquam consequat libero ac maximus pulvinar. Praesent faucibus sed ipsum eu sagittis. Proin fringilla, turpis et efficitur ultricies, nisi nisi consectetur metus, faucibus tristique ante urna in risus.');
const imageBuffer = Buffer.alloc(824, 'Qk04AwAAAAAAADYAAAAoAAAAEAAAABAAAAABABgAAAAAAAIDAAASCwAAEgsAAAAAAAAAAAAAAAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/////////////////////////////////////////////////////////AAD/AAD/////////////////////////////////////////////////////////AAD/AAD/////////////////////////////////////////////////////////AAD/AAD/////////////////////////////////////////////////////////AAD/AAD/////////////////////////////////////////////////////////AAD/AAD/ADb/ADb/ADb/ADX//v7/ADb/ADb/////////ADb/lLT/ADb/7vP/ADb/AAD/AAD/ADb/////ADb/////ADb/////ADb/////XpL/////ADb/////7vP/ADb/AAD/AAD/ADb/////////////////////////////////////////////7vP/////AAD/AAD/////////////////////////////////////////////////////////AAD/AAD/////////////////////////////////////////////////////////AAD/AAD/////////////////////////////////////////////////////////AAD/AAD/////////////////////////////////////////////////////////AAD/AAD/////////////////////////////////////////////////////////AAD/AAD/////////////////////////////////////////////////////////AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAA=', 'base64');
const binaryBuffer = Buffer.alloc(8192, 0);

class FileStream extends Readable {
  constructor({ buffer, headers }) {
    super();
    this.headers = headers;

    // Do not access these properties directly
    this._file = buffer;
    this._currentPosition = 0;
  }

  _read() {
    const currentBuffer = this._file.subarray(this._currentPosition, this._currentPosition + 64);
    if (currentBuffer.length > 0) {
      this._currentPosition += currentBuffer.length;
      this.push(currentBuffer);
    } else {
      this.push(null);
    }
  }
}

const createFile = (buffer, contentType, contentLength) => ({
  buffer,
  headers: {
    'content-type': contentType || 'application/octet-stream',
    'content-length': contentLength || buffer.length,
  },
});

const createTextFile = (contentLength) => createFile(textBuffer, 'text/plain', contentLength);
const createImageFile = (contentLength) => createFile(imageBuffer, 'image/bmp', contentLength);
const createBinaryFile = (contentLength) => createFile(
  binaryBuffer,
  'application/octet-stream',
  contentLength,
);

const files = {
  'https://my-network-server/1.txt': createTextFile(),
  'https://my-network-server/2.txt': createTextFile(),
  'https://my-network-server/3.txt': createTextFile(123),
  'https://my-network-server/1.bmp': createImageFile(),
  'https://my-network-server/2.bmp': createImageFile(),
  'https://my-network-server/3.bmp': createImageFile(),
  'https://my-network-server/1.bin': createBinaryFile(),
};

const DeferredPromise = () => {
  let resolve, reject;
  let promise = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  return { resolve, reject, promise };
}

const createStreamController = () => new EventEmitter();

const createDownloadFile = (abortController, streamController) => {
  const streamEnd = DeferredPromise();
  const streamClose = DeferredPromise();

  const onAbort = () => abortController.abort();

  const downloadFile = (url, { signal }) => new Promise((resolve, reject) => {
    const file = files[url];
    if (!file) {
      reject(new Error("File not found"));
      return;
    }

    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    const stream = new FileStream(file);
    const onPause = () => stream.pause();
    const onResume = () => stream.resume();
    const onError = () => stream.destroy(new Error('An error occurred while transferring the file'));
    streamController.on('pause', onPause);
    streamController.on('resume', onResume);
    streamController.on('error', onError);

    stream.on('end', () => streamEnd.resolve());
    stream.on('close', () => {
      streamClose.resolve();
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      streamController.off('pause', onPause);
      streamController.off('resume', onResume);
      streamController.off('error', onError);
    });
    resolve(stream);
  });

  return { downloadFile, streamEnd, streamClose };
}

const createRequest = ({ body = {}, method = 'GET', params = {}, query = {} } = {}) => ({
  body,
  method,
  params,
  query,
});

class Response {
  constructor() {
    this.headers = {};
    this.statusCode = 200;
    this._data = [];
  }

  get(name) {
    return this.headers[name.toLowerCase()];
  }

  set(name, value) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  send(body) {
    this._data.push(body);
    return this;
  }

  json(body) {
    this.type('application/json');
    this.send(JSON.stringify(body));
    return this;
  }

  type(type) {
    this.set('content-type', type);
    return this;
  }

  end() {}

  get data() {
    return this._data.length > 1 ? this._data : this._data[0];
  }
}

const callControllerFunc = async (func, reqOptions) => {
  const req = createRequest(reqOptions);
  const res = new Response();
  const result = await Promise.resolve(func(req, res));

  return { req, res, result };
}

describe('createController', () => {
  let downloadFile;
  let downloadFileStreamEndPromise;
  let downloadFileStreamClosePromise;
  let downloadFileAbortController;
  let downloadFileStreamController;
  let controller;

  beforeEach(() => {
    downloadFileAbortController = new AbortController();
    downloadFileStreamController = createStreamController();
    const d = createDownloadFile(downloadFileAbortController, downloadFileStreamController);
    downloadFile = jest.fn(d.downloadFile);
    controller = createController({ downloadFile });
    downloadFileStreamEndPromise = d.streamEnd.promise;
    downloadFileStreamClosePromise = d.streamClose.promise;
  });

  const download = (url) => callControllerFunc(controller.download, { body: { url } });
  const getFile = (id) => callControllerFunc(controller.getFile, { params: { id } });
  const status = (id) => callControllerFunc(controller.status, { params: { id } });
  const cancel = (id) => callControllerFunc(controller.cancel, { body: { id } });

  const getResponseDataId = (res) => {
    if (res.get('content-type') !== 'application/json') {
      throw new Error('Content type is not application/json!');
    }

    const json = JSON.parse(res.data);
    return json.data.id;
  }

  describe('download', () => {
    it('exports download function in the controller', () => {
      expect(controller.download).toBeInstanceOf(Function);
    });

    it('handles downloading files', async () => {
      const urls = [
        'https://my-network-server/1.txt',
        'https://my-network-server/2.txt',
        'https://my-network-server/1.bmp',
        'https://my-network-server/2.bmp',
      ];
      const results = await Promise.all(urls.map((url) => download(url)));

      results.forEach((result) => {
        expect(result.res.get('content-type')).toEqual('application/json');
        expect(JSON.parse(result.res.data)).toEqual({
          data: {
            id: expect.any(Number),
            error: null,
            status: 'pending',
            size: null,
          },
          status: 'success',
        });
      });

      await downloadFileStreamEndPromise;
    });

    it('handles downloading files with incorrect Content-Length header', async () => {
      const url = 'https://my-network-server/3.txt';
      const downloadResult = await download(url);
      const id = getResponseDataId(downloadResult.res);

      expect(downloadResult.res.get('content-type')).toEqual('application/json');
      expect(JSON.parse(downloadResult.res.data)).toEqual({
        data: {
          id: expect.any(Number),
          error: null,
          status: 'pending',
          size: null,
        },
        status: 'success',
      });

      const firstStatusResult = await status(id);
      expect(JSON.parse(firstStatusResult.res.data).data.size).toEqual(files[url].headers['content-length']);

      await downloadFileStreamClosePromise;

      const secondStatusResult = await status(id);
      expect(JSON.parse(secondStatusResult.res.data).data.size).toEqual(files[url].buffer.length);
    });
  });

  describe('cancel', () => {
    it('exports cancel function in the controller', () => {
      expect(controller.cancel).toBeInstanceOf(Function);
    });

    it('handles cancellation of ongoing downloads', async () => {
      const url = 'https://my-network-server/1.bin';
      const downloadResult = await download(url);
      const id = getResponseDataId(downloadResult.res);

      const cancelResult = await cancel(id);
      expect(JSON.parse(cancelResult.res.data)).toEqual({
        status: 'success',
      });
      await downloadFileStreamClosePromise;
    });

    it('handles files with unknown IDs', async () => {
      const cancelResult = await cancel('9999');
      expect(cancelResult.res.statusCode).toEqual(404);
      expect(JSON.parse(cancelResult.res.data)).toEqual({
        status: 'error',
        error: {
          message: 'File not found',
        }
      });
    });

    it('handles already downloaded files', async () => {
      const url = 'https://my-network-server/1.bin';
      const downloadResult = await download(url);
      const id = getResponseDataId(downloadResult.res);
      await downloadFileStreamClosePromise;

      const cancelResult = await cancel(id);
      expect(cancelResult.res.statusCode).toEqual(400);
      expect(JSON.parse(cancelResult.res.data)).toEqual({
        status: 'error',
        error: {
          message: 'Cannot cancel already downloaded file',
        },
      });
    });

    it('handles missing id in request params', async () => {
      const cancelResult = await cancel();
      expect(cancelResult.res.statusCode).toEqual(400);
      expect(JSON.parse(cancelResult.res.data)).toEqual({
        status: 'error',
        error: {
          message: 'You need to provide the \'id\' parameter',
        },
      });
    });
  });

  describe('status', () => {
    it('exports status function in the controller', () => {
      expect(controller.status).toBeInstanceOf(Function);
    });

    it('returns file details for existing file IDs', async () => {
      const url = 'https://my-network-server/1.txt';
      const downloadResult = await download(url);
      const id = getResponseDataId(downloadResult.res);

      const { res } = await status(id);
      expect(res.get('content-type')).toEqual('application/json');
      expect(res.statusCode).toEqual(200);
      expect(JSON.parse(res.data)).toEqual({
        status: 'success',
        data: {
          status: 'downloading',
          id,
          size: files[url].buffer.length,
          error: null,
        }
      });

      await downloadFileStreamEndPromise;
    });

    it('returns correct file details for downloaded files and known file IDs', async () => {
      const url = 'https://my-network-server/1.txt';
      const downloadResult = await download(url);
      const id = getResponseDataId(downloadResult.res);
      await downloadFileStreamClosePromise;

      const { res } = await status(id);
      expect(res.get('content-type')).toEqual('application/json');
      expect(res.statusCode).toEqual(200);
      expect(JSON.parse(res.data)).toEqual({
        status: 'success',
        data: {
          status: 'ready',
          id,
          size: files[url].buffer.length,
          error: null,
        }
      });
    });

    it('returns error for unknown file IDs', async () => {
      const { res } = await status('99999');

      expect(res.get('content-type')).toEqual('application/json');
      expect(res.statusCode).toEqual(404);
      expect(JSON.parse(res.data)).toEqual({
        status: "error",
        error: {
          message: "File not found",
        },
      });
    });

    it('returns error for requests with no ID in params', async () => {
      const { res } = await status();

      expect(res.get('content-type')).toEqual('application/json');
      expect(res.statusCode).toEqual(400);
      expect(JSON.parse(res.data)).toEqual({
        status: "error",
        error: {
          message: "You need to provide the 'id' parameter",
        },
      });
    });

    it('handles cancelled downloads', async () => {
      const url = 'https://my-network-server/1.bin';
      const downloadResult = await download(url);
      const id = getResponseDataId(downloadResult.res);
      await cancel(id);
      await downloadFileStreamClosePromise;
      const statusResult = await status(id);
      expect(JSON.parse(statusResult.res.data)).toEqual({
        status: 'success',
        data: {
          id,
          size: files[url].headers['content-length'],
          status: 'cancelled',
          error: null,
        },
      });
    });
  });

  describe('getFile', () => {
    it('exports getFile function in the controller', () => {
      expect(controller.getFile).toBeInstanceOf(Function);
    });

    it('returns a file in the response for downloaded files and known file IDs', async () => {
      const urls = ['https://my-network-server/1.txt', 'https://my-network-server/1.bmp'];
      const results = await Promise.all(urls.map((url) => download(url)));
      await downloadFileStreamClosePromise;

      for await (const [index, { res }] of results.entries()) {
        expect(res.statusCode).toEqual(200);
        expect(res.get('content-type')).toEqual('application/json');
        const id = getResponseDataId(res);

        const getFileResult = await getFile(id);
        expect(getFileResult.res.statusCode).toEqual(200);
        expect(getFileResult.res.data.equals(files[urls[index]].buffer)).toBe(true);
      }
    });

    it('returns a matching Content-Type header to the one received when downloading a file', async () => {
      const urls = ['https://my-network-server/1.txt', 'https://my-network-server/1.bmp'];
      const results = await Promise.all(urls.map((url) => download(url)));
      await downloadFileStreamClosePromise;

      for await (const [index, { res }] of results.entries()) {
        expect(res.statusCode).toEqual(200);
        expect(res.get('content-type')).toEqual('application/json');
        const id = getResponseDataId(res);

        const getFileResult = await getFile(id);
        expect(getFileResult.res.statusCode).toEqual(200);
        expect(getFileResult.res.get('content-type')).toBe(files[urls[index]].headers['content-type']);
      }
    });

    it('returns error when requesting a file that is not downloaded', async () => {
      const url = 'https://my-network-server/1.bmp';
      const downloadResult = await download(url);
      const id = getResponseDataId(downloadResult.res);

      const downloadingGetFileResult = await getFile(id);
      expect(downloadingGetFileResult.res.statusCode).toEqual(404);

      await downloadFileStreamClosePromise;
    });
  });
});
