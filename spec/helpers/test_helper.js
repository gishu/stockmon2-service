function createStringStream(str) {
    var stream = require('stream');
    var s = new stream.Readable();
    s._read = function noop() { };
    s.push(str);
    s.push(null);
    
    return s;
};
exports.createStringStream = createStringStream;
