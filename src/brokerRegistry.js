var _ = require('lodash');

module.exports = (function () {

    var brokers = {
        "HDFC": function (qty, price, isBuy) {
            var hdfc_brokerage = !isBuy ? 0.00694 : 0.0067;
            return price.times(qty).times(hdfc_brokerage).round(2);
        },
        "ZERODHA": function (qty, price) {
            return price.times(qty).times(0.001136).round(2);
        }
    };
    return {
        hasBroker: (broker) => (_.indexOf(_.keys(brokers), broker) != -1),
        getBrokerageCalc: broker => brokers[broker]
    };

})();