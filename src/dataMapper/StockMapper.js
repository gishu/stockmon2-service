var _ = require('lodash');

module.exports = function(database){
    function getAllStocks(callback){
        try {
            database.execute(db => db.all('select distinct stock from buys order by stock', 
                (err, rows) => {
                    if (err){
                        callback(err, null);
                        return;
                    }
                    callback(null, _.map(rows, row => row.Stock))
                }))
        } catch (err) {
            callback(err,null);
        }
    }
    return {
        getAllStocks
    };
}