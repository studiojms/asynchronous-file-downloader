const { AbortController } = require('abort-controller');

/**
 *  @typedef DownloadFileOptions
 *  @property {AbortSignal} [signal] - {@link AbortController}'s signal to cancel transmitting the data
 *
 *  @typedef ResponseHeaders
 *  @property {string} [content-type]
 *  @property {string} [content-length]
 */

/**
 * @typedef DownloadFileFunction
 * @property {string} url - A valid URL
 * @property {DownloadFileOptions} [options] - Options object
 * @return {Promise<ReadableStream & { headers: ResponseHeaders }>} - Response Promise
 */

/**
 * @param {DownloadFileFunction} downloadFile - injected function for downloading files from specified URL
 */
function createController({ downloadFile }) {
  function download(req, res) {
    const { url } = req.body;

    // Success:
    // res.json({
    //   data: {
    //     id: 0,
    //     status: 'pending',
    //     size: null,
    //     error: null,
    //   },
    //   status: 'success',
    // });
  }

  function cancel(req, res) {
    const { id } = req.body;

    // Missing id:
    // res.status(400).json({
    //   error: {
    //     message: "You need to provide the 'id' parameter",
    //   },
    //   status: "error",
    // });

    // File not found:
    // res.status(404).json({
    //   error: {
    //     message: "File not found",
    //   },
    //   status: "error",
    // });

    // Cancelling downloaded file:
    // res.status(400).json({
    //   error: {
    //     message: "Cannot cancel already downloaded file",
    //   },
    //   status: "error",
    // });

    // Success:
    // res.status(400).json({
    //   status: "success",
    // });
  }

  function status(req, res) {
    const { id } = req.params;
    // Missing id:
    // res.status(400).json({
    //   error: {
    //     message: "You need to provide the 'id' parameter",
    //   },
    //   status: "error",
    // });

    // File not found:
    // res.status(404).json({
    //   error: {
    //     message: "File not found",
    //   },
    //   status: "error",
    // });

    // Success:
    // res.json({
    //   data,
    //   status: "success",
    // });
  }

  function getFile(req, res) {
    const { id } = req.params;

    // File not found:
    // res.status(404).send("File not found");
  }

  return {
    download,
    cancel,
    status,
    getFile,
  };
}

module.exports = createController;
