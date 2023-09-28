sap.ui.define([], function () {
    "use strict";

    return {

        /**
         * Rounds the number unit value to 2 digits
         * @public
         * @param {string} sValue the number string to be rounded
         * @returns {string} sValue with 2 digits rounded
         */
        numberUnit : function (sValue) {
            if (!sValue) {
                return "";
            }
            return parseFloat(sValue).toFixed(2);
        },
        
        secondsParsedToDaysHoursMinutesSeconds: function (sValue, oMainController) {

            if (!sValue) {
                return "";
            }
            
            var seconds = Number(sValue);

            var d = Math.floor(seconds / (3600 * 24));
            var h = Math.floor(seconds % (3600 * 24) / 3600);
            var m = Math.floor(seconds % 3600 / 60);
            var s = Math.floor(seconds % 60);

            var oController = this;

            if (typeof oController.getResourceBundle === "undefined") {

                oController = oMainController;

            }

            var dDisplay = d > 0 ? d + (d == 1 ? " " + oController.getResourceBundle().getText("day") + " " : " " + oController.getResourceBundle().getText("days") + " ") : "";
            var hDisplay = h > 0 ? h + (h == 1 ? " " + oController.getResourceBundle().getText("hour") + " " : " " + oController.getResourceBundle().getText("hours") + " ") : "";
            var mDisplay = m > 0 ? m + (m == 1 ? " " + oController.getResourceBundle().getText("minute") + " " : " " + oController.getResourceBundle().getText("minutes") + " ") : "";
            var sDisplay = s > 0 ? s + (s == 1 ? " " + oController.getResourceBundle().getText("second") + " " : " " + oController.getResourceBundle().getText("seconds") + " ") : "";
    
            return dDisplay + hDisplay + mDisplay + sDisplay;

        }

    };

});