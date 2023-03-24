sap.ui.define([
    "./BaseController",
    "../utils/sharedLibrary",
    "sap/ui/model/json/JSONModel"
], function (BaseController, sharedLibrary, JSONModel) {
    "use strict";

    return BaseController.extend("zslpmprprb.controller.App", {

        onInit: function () {

            var t = this;

            // apply content density mode to root view
            this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
    

            // Getting execution context

            this._getExecutionContext(function () {

               // Prepare model to use in other parts of application

                var oExecutionContext = new sap.ui.model.json.JSONModel({

                    SystemUser: t.oSystemUser

                });
                        
                t.getOwnerComponent().setModel(oExecutionContext, "executionContext");
            });

        },

        /* =========================================================== */
        /* begin: internal methods                                     */
        /* =========================================================== */

        _getExecutionContext: function (callback) {

            var t = this,
                sErroneousExecutionText = this.getResourceBundle().getText("oDataModelReadFailure");

            sharedLibrary.readEntity("SystemUser", sErroneousExecutionText, this, false, true,  function (oData) {
                    t.oSystemUser = oData.results[0];                    
                    return callback();
                    
            });
        },
    });

});