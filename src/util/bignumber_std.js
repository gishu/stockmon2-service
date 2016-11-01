var BigNumber = require('bignumber.js');
BigNumber.config({
    FORMAT: {
        decimalSeperator: '.',
        groupSeperator: ',',
        groupSize: 3
    },
    DECIMAL_PLACES: 2
});
module.exports = BigNumber;