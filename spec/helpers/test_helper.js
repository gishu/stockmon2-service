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

function deleteDb(path) {
    var log = require('debug')('db');
    
    if (path === ':memory:'){ return; }
    
    try {
        fs.accessSync(path, fs.F_OK);
        fs.unlinkSync(path);
    }
    catch (e) {
        if (!(e.code === 'ENOENT')) {
            log(e);
        }

    }

}

function getTradesCsvReadStream(fileName) {
    var csv_path = path.resolve(__dirname, '..', 'datafiles', fileName);
    return fs.createReadStream(csv_path);

}
exports.createStringStream = createStringStream;
exports.deleteDb = deleteDb;
exports.getCsvStream = getTradesCsvReadStream;
