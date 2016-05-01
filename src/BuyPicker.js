module.exports = function (buys, sale) {
    var _ = require('lodash');

    var saleQty = sale.qty,
        qtyToDeduct = 0,
        buyIds = [];
    _.forEach(buys, function (buy) {
        if ((saleQty === 0) || (buy.balance === 0)) {
            return;
        }
        qtyToDeduct = _.min([buy.balance, saleQty]);
        saleQty -= qtyToDeduct;
        buyIds.push(buy.id);
    });
    // todo: saleQty still > 0 - not enough stock
    
    return buyIds;
};