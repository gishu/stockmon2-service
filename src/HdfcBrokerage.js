module.exports = function(qty, price, isBuy){
    var hdfc_brokerage = !isBuy ? 0.00694 : 0.0067 ;
    return price.times(qty).times(hdfc_brokerage).round(2);
};