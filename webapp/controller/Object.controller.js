sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "../model/formatter",
    "../utils/sharedLibrary"
], function (BaseController, JSONModel, History, formatter, sharedLibrary) {
    "use strict";

    return BaseController.extend("zslpmprprb.controller.Object", {

        formatter: formatter,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        /**
         * Called when the worklist controller is instantiated.
         * @public
         */
        onInit: function () {
            // Model used to manipulate control states. The chosen values make sure,
            // detail page shows busy indication immediately so there is no break in
            // between the busy indication for loading the view's meta data
            var oViewModel = new JSONModel({
                busy: true,
                delay: 0
            });

            var oRuntimeModel = new JSONModel({
                editModeActive: false
            });

            this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
            this.setModel(oViewModel, "objectView");

            this.oSemanticPage = this.byId("detailPage");

            this.oSemanticPage.setShowFooter(false);

            this.getOwnerComponent().setModel(oRuntimeModel, "runtimeModel");

            this.initialProblemState = {};

            // Getting  execution context from App.controller

            var oExecutionContext = this.getOwnerComponent().getModel("executionContext");

            // Current system user              

            this.oExecutionContext = oExecutionContext.oData;



        },
        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */

        /**
        * Save button pressed
        */
        onPressProcessorSave: function () {


            this._executeProblemSave();

        },

        /**
        * Processor search value help pressed
        */
        onheaderProcessorSelectValueHelpPress: function () {

            this._openAssigneeSearchDialog();

        },

        /**
        * Processor presseed Take Over button
        */
        onPressProcessorTakeOver: function () {

            this._takeOverProblem();

        },

        /**
        * Edit button pressed
        */
        onPressProcessorEditMode: function () {

            this._switchEditMode();
        },

        /**
         * Event handler  for navigating back.
         * It there is a history entry we go one step back in the browser history
         * If not, it will replace the current entry of the browser history with the worklist route.
         * @public
         */
        onNavBack: function () {
            var sPreviousHash = History.getInstance().getPreviousHash();
            if (sPreviousHash !== undefined) {
                // eslint-disable-next-line sap-no-history-manipulation
                history.go(-1);
            } else {
                this.getRouter().navTo("worklist", {}, true);
            }

        },

        _onBindingChange: function () {
            var oView = this.getView(),
                oViewModel = this.getModel("objectView"),
                oElementBinding = oView.getElementBinding();

            // No data for the binding
            if (!oElementBinding.getBoundContext()) {
                this.getRouter().getTargets().display("objectNotFound");
                return;
            }

            var oResourceBundle = this.getResourceBundle(),
                oObject = oView.getBindingContext().getObject(),
                sObjectGuid = oObject.Guid,
                sObjectId = oObject.ObjectId;

            this.Guid = sObjectGuid;
            this.ObjectId = sObjectId;

            this._setAvailableStatuses(oObject.Status);

            oViewModel.setProperty("/busy", false);

            this._resetEditMode();

        },

        /**
        * Binds the view to the object path.
        * @function
        * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
        * @private
        */
        _onObjectMatched: function (oEvent) {
            var sObjectId = oEvent.getParameter("arguments").objectId;
            this._bindView("/ProblemSet" + sObjectId);

        },
        /* =========================================================== */
        /* internal methods                                            */
        /* =========================================================== */



        /**
        * Switch edit mode
        */
        _switchEditMode: function () {

            var isEditModeActive = this._isEditModeActive(),
                oRuntimeModel = this.getOwnerComponent().getModel("runtimeModel");

            this.oSemanticPage.setShowFooter(!this.oSemanticPage.getShowFooter());

            oRuntimeModel.setProperty("/editModeActive", !isEditModeActive);

            // Save initial state of a problem before changes

            if (this._isEditModeActive()) {

                this._saveProblemStateBeforeEdit();

            }

        },

        /**
        * Refresh texts pane
        */
        _refreshTexts: function () {

            this.getView().byId("textsList").getBinding("items").refresh();

        },

        /**
        * Refresh whole view
        */

        _refreshView: function () {

            this.getView().getElementBinding().refresh(true);
        },

        /**
        * Execute problem take over
        */
        _takeOverProblem: function () {

            var sText = this.getResourceBundle().getText("confirmProblemTakeOver"),
                t = this;

            sharedLibrary.confirmAction(sText, function () {

                var oPayload = {};

                oPayload.ProcessorBusinessPartner = t.oExecutionContext.SystemUser.BusinessPartner;

                sharedLibrary.updateEntityByEdmGuidKey(t.Guid, oPayload, "ProblemSet",
                    t.getResourceBundle().getText("problemUpdatedSuccessfully", t.ObjectId), t.getResourceBundle().getText("problemUpdateFailure"), null,
                    t, function () {

                        t._refreshTexts();
                        t._refreshView();

                    });
            });
        },

        /**
        * Open assignee search dialog
        */
        _openAssigneeSearchDialog: function () {

            var oAssigneeModel = this.changeRequestsUsersCollection;

            this.oAssigneeSearchFragment = sap.ui.xmlfragment("zslpmprprb.view.AssigneeSearch", this);

            this.getView().addDependent(this.oAssigneeSearchFragment);

            this.oAssigneeSearchFragment.open();

            sap.ui.getCore().byId("assigneeSearchDialog").setModel(oAssigneeModel, "assigneeSearchModel");

        },

        _executeProblemSave: function () {

            var oChangedFields = this._getChangedFields(),
                t = this;


            if (oChangedFields.length > 0) {

                var sListOfChangedFields,
                    sSaveConfirmationMessage =  t.getResourceBundle().getText("confirmProblemSavingWithChangedFields");


                for (var k = 0; k < oChangedFields.length; k++) {


                    var oChangedFieldsKeys = Object.keys(oChangedFields[k]);

                    for (var i = 0; i < oChangedFieldsKeys.length; i++) {

                        sListOfChangedFields =
                            sListOfChangedFields ? 
                                sListOfChangedFields +  oChangedFieldsKeys[i] + ":" + oChangedFields[k][oChangedFieldsKeys[i]] : oChangedFieldsKeys[i] + ":" + oChangedFields[k][oChangedFieldsKeys[i]];                
                                sListOfChangedFields = sListOfChangedFields + "\n";
                    
                            }

                }

                sSaveConfirmationMessage = sSaveConfirmationMessage + "\n" + "\n" + sListOfChangedFields;

                sharedLibrary.confirmAction(sSaveConfirmationMessage, function () {

                    t._saveProblem();

                });

            } else

            {

                sharedLibrary.informationAction(t.getResourceBundle().getText("noChangesWereMadeForProblem"),
                function() {

                    return;

                });
            
            }

            // ZZZZZZZZZZZZZZZZZZZZZZ CHECK IF STATUS CHANGED THAN TEXT IS FIELD!!!!!
              // ZZZZZZZZZZZZZZZZZZZZZZ CHECK IF STATUS CHANGED THAN TEXT IS FIELD!!!!!
                // ZZZZZZZZZZZZZZZZZZZZZZ CHECK IF STATUS CHANGED THAN TEXT IS FIELD!!!!!
                  // ZZZZZZZZZZZZZZZZZZZZZZ CHECK IF STATUS CHANGED THAN TEXT IS FIELD!!!!!
                    // ZZZZZZZZZZZZZZZZZZZZZZ CHECK IF STATUS CHANGED THAN TEXT IS FIELD!!!!!
                      // ZZZZZZZZZZZZZZZZZZZZZZ CHECK IF STATUS CHANGED THAN TEXT IS FIELD!!!!!

                        // ZZZZZZZZZZZZZZZZZZZZZZ CHECK IF STATUS CHANGED THAN TEXT IS FIELD!!!!!
                          // ZZZZZZZZZZZZZZZZZZZZZZ CHECK IF STATUS CHANGED THAN TEXT IS FIELD!!!!!
                            // ZZZZZZZZZZZZZZZZZZZZZZ CHECK IF STATUS CHANGED THAN TEXT IS FIELD!!!!!
                              // ZZZZZZZZZZZZZZZZZZZZZZ CHECK IF STATUS CHANGED THAN TEXT IS FIELD!!!!!
                                // ZZZZZZZZZZZZZZZZZZZZZZ CHECK IF STATUS CHANGED THAN TEXT IS FIELD!!!!!
                                
            // MAP FOR ALL CHANGED FIELDS WITH FLAG



        },


        /**
        * Save problem
        */
        _saveProblem: function () {


        },

        /**
        * Get changed fields
        */
        _getChangedFields: function () {

            var oProblemFieldsInScope = {},
                oProblemChangedFields = [],
                oProblemChangedField = {};

            //oProblemChangedFields.Text = this.byId('communicationTabTextInputArea').getValue();

            oProblemFieldsInScope.Status = this.byId('headerStatusSelect').getSelectedKey();

            // zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz do it!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz do it!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz do it!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz do it!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz do it!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            //     oProblemChangedFields.ProcessorBusinessPartner = this.byId('headerProcessorSelect').getSelectedKey();
            // zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz do it!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz do it!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz do it!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz do it!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

            var oProblemFieldsInScopeKeys = Object.keys(oProblemFieldsInScope);

            for (var i = 0; i < oProblemFieldsInScopeKeys.length; i++) {

                if (this.initialProblemState[oProblemFieldsInScopeKeys[i]] !== oProblemFieldsInScope[oProblemFieldsInScopeKeys[i]]) {


                    oProblemChangedField[oProblemFieldsInScopeKeys[i]] = oProblemFieldsInScope[oProblemFieldsInScopeKeys[i]];

                    oProblemChangedFields.push(oProblemChangedField);


                }

            }

            return oProblemChangedFields;

        },

        /**
         * Reset edit mode 
        */
        _resetEditMode: function () {

            var oRuntimeModel = this.getOwnerComponent().getModel("runtimeModel");
            oRuntimeModel.setProperty("/editModeActive", false);

            this.oSemanticPage.setShowFooter(false);

            this.initialProblemState = {};


        },

        /**
         * Set a list of possible next statuses according to a current status
        */
        _setAvailableStatuses: function (sStatus) {

            var sPath = "Code";
            var sOperator = "EQ";

            var oBinding = this.byId("headerStatusSelect").getBinding("items");
            oBinding.filter([new sap.ui.model.Filter(sPath, sOperator, sStatus)]);

        },

        /**
         * Save problem state before edit
         */
        _saveProblemStateBeforeEdit: function () {

            var oView = this.getView(),
                oViewModel = this.getModel("objectView"),
                oObject = oView.getBindingContext().getObject();

            this.initialProblemState = oObject;

        },

        /**
         * Are we currently in edit mode
         */

        _isEditModeActive: function () {

            return this.getOwnerComponent().getModel("runtimeModel").getProperty("/editModeActive");

        },

        /**
         * Binds the view to the object path.
         * @function
         * @param {string} sObjectPath path to the object to be bound
         * @private
         */
        _bindView: function (sObjectPath) {
            var oViewModel = this.getModel("objectView");

            this.getView().bindElement({
                path: sObjectPath,
                events: {
                    change: this._onBindingChange.bind(this),
                    dataRequested: function () {
                        oViewModel.setProperty("/busy", true);
                    },
                    dataReceived: function () {
                        oViewModel.setProperty("/busy", false);
                    }
                }
            });
        }
    });

});
