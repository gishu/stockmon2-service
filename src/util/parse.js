var BigNumber = require('./bignumber_std.js');
var moment = require('moment');

module.exports = {
    toBigNumber: function (value) {
        if (!value){
            return new BigNumber(0);
        }

        if (typeof (value) === 'string') {
            return new BigNumber(value.replace(',', ''));
        }
        return value;
    },

    toDate: function (date) {
        return (moment.isMoment(date) ? date : moment(date));
    }
};