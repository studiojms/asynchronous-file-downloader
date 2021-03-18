# Node.js Asynchronous File Downloader

## Objective

Your goal is to write a controller for a File Downloader application that uses
Express.js-like API for request handling. The files should be downloaded one by one using HTTP,
following the FIFO method and stored in the program's memory.

Keep in mind that both the Express.js requests and HTTP connections you'll be making are
mocked and will happen virtually, so you cannot debug them outside this application's test runner.


## Dependencies

The file exports one function named `createController` and it has one dependency
that is always injected:

-   `downloadFile(url, options)` where:
    - `url` is a string containing valid URL,
    - `options` is an optional object containing `signal` property that is an instance of `AbortSignal` (from `abort-controller` module).

    Returns a `Promise` instance that:
    - resolves with a `ReadableStream` instance with additional `headers` property containing response HTTP headers.
    - rejects with an `Error` if resource cannot be found.


## Controller functions

- `download(req, res)` - Add the file to download queue
    - `url` - (required) string containing URL of the file to download
- `cancel(req, res)` - Cancel download
    - `id` - (required) unique identifier of the download
- `status(req, res)` - Get download status
    - `id` - (required) unique identifier of the download
- `getFile(req, res)` - Get downloaded file content
    - `id` - (required) unique identifier of the download


## Acceptance criteria

- All files need to be downloaded and stored
- File storage must be in memory, the files used in tests are under 10KB each
- Files must be downloaded in the FIFO (First In First Out) way, one at a time
- Downloading files should be asynchronous and not block any of the controller's functions from sending a response
- It should support any type of file, text- or binary- based
- Any file that is still pending or downloading can be cancelled by the user.
- `getFile` should send the correct `Content-Type` in the response
- IDs generated for each download should be of type number, incrementing by 1 each request beginning from 0
- Bonus: Some URLs may return `Content-Length` header that is not equal the amount of data sent. You should update the `size` in status response for that file as soon as you detect that.
- You can use `Promise`, `async/await` or a mixture of them
- You can import modules from Node.js standard library


## API differences

- Express.js
    - `Request`
        - Exposed properties: `body`, `method`, `params`, `query`
    - `Response`
        - Exposed properties: `get(name)`, `set(name, value)`, `status(code)`, `send(body)`,
        `json(body)`, `type(type)`, `end()`
        - It's not extending `WritableStream`

## Grading

Your solution will be graded on the basis of two measurements:
- 90%: Automatic unit tests in `index.test.js`
- 10%: Automatic code quality analysis (detects common flaws like unused variables or huge functions)


## Read only files
You should only have to edit the file `index.js`. You can't edit any other existing files (including `package.json` and `index.test.js`) or your solution might not be accepted.
