describe('GainsComputer', function () {
    it('can compute long term gains', function (done) {
        var fs = require('fs');
        var path = require('path');
        var parse = require('../../src/CsvParser.js');
        var account = require('../../src/Account.js');
        var make = require('../../src/Trade.js');
        
        var _ = require('lodash');

        var csv_path = path.resolve(__dirname,'datafiles','sample_trades.csv');
        var istream = fs.createReadStream(csv_path);
        var a = account.create(1, 'G');
        parse(istream, function (err, results) {
            expect(err).toBeNull();
           
            a.register(results.trades);
            
            expect(a.getGains()).toEqual([
                make.makeGain('2009-09-24 00:00:00', 'HDFCBANK', 10, '1030', '1607.1', '176.69', '5514.41'),
                make.makeGain('2009-09-24 00:00:00', 'HDFC', 4, '2240', '2705', '132.52', '1727.48')]);
                
            done();
        });
        
        
    });
});