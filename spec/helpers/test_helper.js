var fs = require('fs'),
    path = require('path');

function createStringStream(str) {
    var stream = require('stream');
    var s = new stream.Readable();
    s._read = function noop() { };
    s.push(str);
    s.push(null);

    return s;
}

function deleteDb() {
    try {
        fs.accessSync('./stockmon.sqlite', fs.F_OK);
        fs.unlinkSync('./stockmon.sqlite');
    }
    catch (e) {
        if (!(e.code === 'ENOENT')) {
            console.log(e);
        }

    }

}

function getTradesCsvReadStream(fileName) {
    var csv_path = path.resolve(__dirname, '..','jasmine_examples', 'datafiles', fileName);
    return fs.createReadStream(csv_path);

}
exports.createStringStream = createStringStream;
exports.deleteDb = deleteDb;
exports.getCsvStream = getTradesCsvReadStream;
