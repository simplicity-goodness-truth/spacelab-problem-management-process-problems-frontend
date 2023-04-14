// Constants classes

const textTypes = Object.freeze(
    class textTypes {
        static reply = 'SU01';
        static description = 'SU99';
        static reproductionSteps = 'SURS';
        static internalNote = 'SU04';
        static solution = 'SUSO';
        static businessConsequences = 'SUBI';
    });

const statusNames = Object.freeze(
    class statusNames {
        static new = 'E0001'
        static approved = 'E0015';
        static inProcess = 'E0002';
        static customerAction = 'E0003';
        static solutionProvided = 'E0005';
        static confirmed = 'E0008';
        static withdrawn = 'E0010';
        static onApproval = 'E0016';
        static informationRequested = 'E0017';
    });

const textTypesForStatuses = Object.freeze(
    class textTypesForStatuses {

        static approved = 'SU01';
        static customerAction = 'SU01';
        static solutionProvided = 'SUSO';
        static informationRequested = 'SU01';

    });

const statusesWithMandatoryTextComments = Object.freeze(
    class statusesWithMandatoryTextComments {
        static statuses = ['customerAction', 'solutionProvided', 'approved', 'informationRequested', 'withdrawn'];
    });

const statusesWithPossibleProccessorChange = Object.freeze(
    class statusesWithPossibleProccessorChange {
        static statuses = ['inProcess', 'new', 'approved'];
    });

sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "../model/formatter",
    "../utils/sharedLibrary",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (BaseController, JSONModel, History, formatter, sharedLibrary, Filter, FilterOperator) {
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

            // Getting processors list from App.controller

            this.oProcessorsList = this.getOwnerComponent().getModel("processorsList");

            this.selectedProcessor;

            // Prepare empty models (which will be properly filled during a runtime)

            this._prepareEmptyModels();
        },
        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */


        /**
       * Processor pressed on SLA IRT History
       */
        onPressIrtHistory: function () {

            this._openSLAIrtHistoryDialog();
        },

        /**
        * Processor pressed on SLA MPT History
        */
        onPressMptHistory: function () {

            this._openSLAMptHistoryDialog()

        },

        /**
        * Processor pressed on a Return from Withdrawal button
        */
        onPressReturnFromWithdrawal: function (oEvent) {
            this._returnFromWithdrawal();
        },

        /**
        * Processor reset button pressed
        */
        onPressResetProcessor: function (oEvent) {
            this._resetProcessor();
        },

        /**
        * Prioirty selector changed
        */
        onChangePrioritySelect: function (oEvent) {

        },

        /**
        * Status selector changed
        */
        onChangeStatusSelect: function (oEvent) {


            sharedLibrary.dropFieldState(this, "communicationTabTextInputArea");
            this._setProcessorChangePossibility(oEvent.getSource().getSelectedKey());

        },

        /**
        * Text area text entered
        */
        onChangeTextArea: function () {

            sharedLibrary.dropFieldState(this, "communicationTabTextInputArea");

        },

        /**
        * Processors search processing
        */
        onProcessorSearch: function (oEvent) {

            var sValue = oEvent.getParameter("value"),
                oFilter = [],
                oBinding = oEvent.getParameter("itemsBinding");

            oFilter.push(new Filter("FullName", FilterOperator.Contains, sValue));

            oBinding.filter(oFilter);

            // Additional search by search tags if no chance to find by name

            if (oBinding.aIndices.length === 0) {

                oFilter = [];

                oFilter.push(new Filter("SearchTag1", FilterOperator.Contains, sValue));

                oBinding.filter(oFilter);
            }
        },

        /**
        * Close processor search dialog
        */
        onProcessorSearchDialogClose: function (oEvent) {

            this._setSelectedProcessor(oEvent);
            this._destroyProcessorSearchDialog();
        },

        /**
        * Save button pressed
        */
        onPressProcessorSave: function () {

            this._executeProblemSave();

        },

        /**
        * Processor search value help pressed
        */
        onHeaderProcessorSelectValueHelpPress: function () {

            this._openProcessorSearchDialog();

        },

        /**
        * Processor presseed Take Over button
        */
        onPressProcessorTakeOver: function () {

            this._takeOverProblem();

        },


        /**
        * Close SLA IRT History dialog
        */
        onCloseSLAMptHistoryDialog: function () {

            this._destroySLAMptHistoryDialog();

        },


        /**
        * Close SLA IRT History dialog
        */
        onCloseSLAIrtHistoryDialog: function () {

            this._destroySLAIrtHistoryDialog();

        }

        ,

        /**
        * Refresh button pressed
        */

        onPressProcessorRefresh: function () {

            this._refreshApplicationAndSwitchOffEditMode();
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
            this.ProcessorFullName = oObject.ProcessorFullName;
            this.Status = oObject.Status;
            this.ProductGuid = oObject.ProductGuid;
            this.Priority = oObject.Priority;

            this._setAvailableStatuses(oObject.Status);

            this._setProcessorToValueFromEntitySet();

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
        * Return a problem from Withdrawn to In Process
        */
        _returnFromWithdrawal: function () {

            var sText = this.getResourceBundle().getText("confirmReturnFromWithdrawal"),
                t = this,
                oPayload = {};

            oPayload.Status = statusNames.inProcess;

            sharedLibrary.confirmAction(sText, function () {

                sharedLibrary.updateEntityByEdmGuidKey(t.Guid, oPayload, "ProblemSet",
                    null, t.getResourceBundle().getText("problemUpdateFailure"), null,
                    t, function () {

                        sap.m.MessageBox.information(t.getResourceBundle().getText("problemUpdatedSuccessfully", t.ObjectId));

                        t._refreshApplicationAndSwitchOffEditMode();

                    });

            });


        },

        /**
        * Prepare empty control models (it wiill be filled later in runtime)
        */
        _prepareEmptyModels: function () {

            var oEmptyModel = new sap.ui.model.json.JSONModel({
            });

            this.byId("headerPrioritySelect").setModel(oEmptyModel);

        },

        /**
        * Get list of priorities for a product
        */
        _setupAvailablePriorities: function () {

            var t = this,
                sErroneousExecutionText = this.getResourceBundle().getText("oDataModelReadFailure");

            sharedLibrary.readEntitiesAssoiciationByEdmGuidKey("Product", this.ProductGuid, "Priority",
                sErroneousExecutionText, this, false, false, function (oData) {

                    t.oPrioritiesList = oData.results;

                    // We need to recompile the array of priorities, so that a currently set prioirty is put to a first place

                    var iCurrentPriorityPosition = t.oPrioritiesList.findIndex(obj => obj.Code === t.Priority),
                        oCurrentPriorityObject = t.oPrioritiesList[iCurrentPriorityPosition];

                    if (iCurrentPriorityPosition !== 0) {

                        var oFirstElement = t.oPrioritiesList[0];
                        t.oPrioritiesList[0] = oCurrentPriorityObject;
                        t.oPrioritiesList[iCurrentPriorityPosition] = oFirstElement;
                    }

                    var oPrioritiesList = new sap.ui.model.json.JSONModel({

                        PrioritiesList: t.oPrioritiesList

                    });

                    t.byId("headerPrioritySelect").setModel(oPrioritiesList);

                    // If only one priority is available, then we prohibit disabling

                    if (t.oPrioritiesList.length === 1) {
                        t.byId("headerPrioritySelect").setProperty("enabled", false);
                    } else {
                        t.byId("headerPrioritySelect").setProperty("enabled", true);
                    }

                });
        },

        /**
        * Set processor name to a bvalue from read entity set
        */
        _setProcessorToValueFromEntitySet: function () {

            var oView = this.getView(),
                oObject = oView.getBindingContext().getObject();

            this.selectedProcessor = oObject.ProcessorBusinessPartner;
            this.byId('headerProcessorSelect').setValue(oObject.ProcessorFullName);
        },

        /**
        * Set possibility of processor change
        */
        _setProcessorChangePossibility: function (sStatusCode) {

            var t = this,
                bPossibility = false;

            for (var key1 in statusNames) {

                if (sStatusCode == statusNames[key1]) {

                    if (statusesWithPossibleProccessorChange.statuses.includes(key1)) {

                        bPossibility = true;

                    }
                }
            }

            t.byId("headerProcessorSelect").setProperty("enabled", bPossibility);
            t.byId("buttonResetProcessor").setProperty("visible", bPossibility);


            if (!bPossibility) {

                this._setProcessorToValueFromEntitySet();

            }

        },

        /**
        * Set selected processor
        */
        _setSelectedProcessor: function (oEvent) {

            var aContexts = oEvent.getParameter("selectedContexts"),
                t = this;

            // Something was selected

            if (aContexts && aContexts.length) {

                var selectedValue = aContexts.map(function (oContext) {
                    return oContext.getObject().FullName;
                }).join(", "),
                    selectedCode = aContexts.map(function (oContext) {
                        return oContext.getObject().BusinessPartner;
                    }).join(", ");

                // Setting values of a specified control and storing selected code

                t.byId('headerProcessorSelect').setValue(selectedValue);

                t.selectedProcessor = selectedCode;

            }

            oEvent.getSource().getBinding("items").filter([]);

        },

        /**
        * Destroy processor search dialog
        */
        _destroyProcessorSearchDialog: function () {

            this.oProcessorSearchFragment.destroy(true);
        },

        /**
        * Get tabs full Id by Id mask
        */
        _getFullTabIdByIdMask: function (sIdMask) {

            var oIconTabBarItems = this.byId("iconTabBar").getItems();

            for (var i = 0; i < oIconTabBarItems.length; i++) {

                if (oIconTabBarItems[i].sId.indexOf(sIdMask) > 0) {

                    return oIconTabBarItems[i].sId;

                }
            }

        },

        /**
        * Switch edit mode
        */
        _switchEditMode: function () {

            var isEditModeActive = this._isEditModeActive(),
                oRuntimeModel = this.getOwnerComponent().getModel("runtimeModel");

            this.oSemanticPage.setShowFooter(!this.oSemanticPage.getShowFooter());

            oRuntimeModel.setProperty("/editModeActive", !isEditModeActive);

            // Actions when Edit mode has been switched on

            if (this._isEditModeActive()) {

                // Reset text area input

                sharedLibrary.dropFieldState(this, "communicationTabTextInputArea");
                this.byId("communicationTabTextInputArea").setValue("");

                // Reset status selector

                this.byId("headerStatusSelect").setSelectedKey(this.Status);

                // Reset processor selector

                this.byId("headerProcessorSelect").setValue(this.ProcessorFullName);

                // Save initial state of a problem before changes

                this._storeProblemStateBeforeEdit();

                //Set availability of processor change

                this._setProcessorChangePossibility(this.Status);

                //  Loading a list of priorities

                this._setupAvailablePriorities();

                // Switching to communication tab

                var sTabCommunicationFullName = this._getFullTabIdByIdMask("tabCommunication");

                this.byId("iconTabBar").setSelectedKey(sTabCommunicationFullName);

            }

        },

        /**
        * Creation of a problem text
        */
        _createProblemText: function (sGuid, sTextId, sText, callback) {

            var oTextPayload = {};

            oTextPayload.Tdid = sTextId;
            oTextPayload.TextString = sText;

            sharedLibrary.createSubEntity("ProblemSet", sGuid, "Text", oTextPayload,
                null, this.getResourceBundle().getText("textCreationFailure"),
                this, function () {

                    return callback();

                });
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
        * Destroy SLA IRT History dialog
        */
        _destroySLAIrtHistoryDialog: function () {

            this.oSLAIrtHistoryFragment.destroy(true);
        },


        /**
        * Destroy SLA MPT History dialog
        */
        _destroySLAMptHistoryDialog: function () {

            this.oSLAMptHistoryFragment.destroy(true);
        },


        /**
        * Get SLA IRT History from backend
        */
        _setSLAIrtHistory: function () {

            var t = this,
                sErroneousExecutionText = this.getResourceBundle().getText("oDataModelReadFailure");

            sharedLibrary.readEntitiesAssoiciationByEdmGuidKey("Problem", this.Guid, "SLAIrtHistory",
                sErroneousExecutionText, this, false, false, function (oData) {

                    t.oSLAIrtHistory = oData.results;

                });


        },

        /**
        * Get SLA MPT History from backend
        */
        _setSLAMptHistory: function () {

            var t = this,
                sErroneousExecutionText = this.getResourceBundle().getText("oDataModelReadFailure");

            sharedLibrary.readEntitiesAssoiciationByEdmGuidKey("Problem", this.Guid, "SLAMptHistory",
                sErroneousExecutionText, this, false, false, function (oData) {

                    t.oSLAMptHistory = oData.results;

                });


        },

        /**
     * Open SLA MPT History dialog
     */
        _openSLAMptHistoryDialog: function () {


            var t = this;

            this._setSLAMptHistory();

            this.oSLAMptHistoryFragment = sap.ui.xmlfragment("zslpmprprb.view.SLAMptHistory", this);

            this.getView().addDependent(this.oSLAMptHistoryFragment);

            this.oSLAMptHistoryFragment.open();

            var oSLAMptHistory = new sap.ui.model.json.JSONModel({

                SLAMptHistoryList: t.oSLAMptHistory

            });

            sap.ui.getCore().byId("SLAMptHistoryTable").setModel(oSLAMptHistory, "SLAMptHistoryModel");

        },


        /**
        * Open SLA IRT History dialog
        */
        _openSLAIrtHistoryDialog: function () {


            var t = this;

            this._setSLAIrtHistory();

            this.oSLAIrtHistoryFragment = sap.ui.xmlfragment("zslpmprprb.view.SLAIrtHistory", this);

            this.getView().addDependent(this.oSLAIrtHistoryFragment);

            this.oSLAIrtHistoryFragment.open();

            var oSLAIrtHistory = new sap.ui.model.json.JSONModel({

                SLAIrtHistoryList: t.oSLAIrtHistory

            });

            sap.ui.getCore().byId("SLAIrtHistoryTable").setModel(oSLAIrtHistory, "SLAIrtHistoryModel");

        },

        /**
        * Open processor search dialog
        */
        _openProcessorSearchDialog: function () {


            this.oProcessorSearchFragment = sap.ui.xmlfragment("zslpmprprb.view.ProcessorSearch", this);

            this.getView().addDependent(this.oProcessorSearchFragment);

            this.oProcessorSearchFragment.open();

            sap.ui.getCore().byId("processorSearchDialog").setModel(this.oProcessorsList, "processorSearchModel");

        },

        /**
        * Execute problem save
        */
        _executeProblemSave: function () {

            var oChangedFields = this._getChangedFields(),
                t = this,
                sSelectedTextValue,
                sFieldName,
                bStatusHasBeenChanged = false,
                oPayload = {},
                oTextPayload = {},
                sNewStatus;

            if (oChangedFields.length > 0) {

                var sListOfChangedFields,
                    sSaveConfirmationMessage = t.getResourceBundle().getText("confirmProblemSavingWithChangedFields");

                for (var k = 0; k < oChangedFields.length; k++) {

                    var oChangedFieldsKeys = Object.keys(oChangedFields[k]);

                    for (var i = 0; i < oChangedFieldsKeys.length; i++) {

                        // Text values of selected fields

                        switch (oChangedFieldsKeys[i]) {
                            case 'Status':

                                sSelectedTextValue = t._getSelectedStatusText(oChangedFields[k][oChangedFieldsKeys[i]]);
                                sFieldName = t.getResourceBundle().getText("problemStatusTitle");
                                bStatusHasBeenChanged = true;
                                sNewStatus = oChangedFields[k][oChangedFieldsKeys[i]];
                                break;
                            case 'ProcessorBusinessPartner':
                                sSelectedTextValue = t._getSelectedProcessorFullName();
                                sFieldName = t.getResourceBundle().getText("problemProcessorFullNameTitle");
                                break;
                            case 'Priority':
                                sSelectedTextValue = t._getSelectedPriorityText(oChangedFields[k][oChangedFieldsKeys[i]]);
                                sFieldName = t.getResourceBundle().getText("problemPriorityTitle");
                                break;
                            case 'Note':
                                sSelectedTextValue = t._getTextFieldValue();
                                sFieldName = t.getResourceBundle().getText(t._getTextTypeForStatus(sNewStatus) + "TextTitle");
                                break;
                            default:
                                sSelectedTextValue = oChangedFields[k][oChangedFieldsKeys[i]];
                                break;

                        }

                        // Limit preview for 50 characters to avoid trash on screen 

                        if (sSelectedTextValue.length > 50) {

                            sSelectedTextValue = sSelectedTextValue.slice(0, 50) + "...";
                        }

                        sListOfChangedFields =
                            sListOfChangedFields ?
                                sListOfChangedFields + sFieldName + ":" + " " + sSelectedTextValue : sFieldName + ":" + " " + sSelectedTextValue;
                        sListOfChangedFields = sListOfChangedFields + "\n";

                        oPayload[oChangedFieldsKeys[i]] = oChangedFields[k][oChangedFieldsKeys[i]];

                    }

                }

                sSaveConfirmationMessage = sSaveConfirmationMessage + "\n" + "\n" + sListOfChangedFields;

                sharedLibrary.confirmAction(sSaveConfirmationMessage, function () {

                    var sText = t._getTextFieldValue();

                    sharedLibrary.dropFieldState(t, "communicationTabTextInputArea");

                    if (t._isTextMandatoryForStatus(oPayload.Status) && bStatusHasBeenChanged && (sText.length == '0')) {

                        sharedLibrary.setFieldErrorState(t, "communicationTabTextInputArea");
                        sap.m.MessageBox.error(t.getResourceBundle().getText("statusChangeTextNotEntered"));

                    } else {

                        // Determination of a text type

                        oTextPayload.Tdid = t._getTextTypeForStatus(oPayload.Status);
                        oTextPayload.TextString = sText;

                        t._saveProblem(oPayload, oTextPayload);

                    }

                });

            } else {

                sharedLibrary.informationAction(t.getResourceBundle().getText("noChangesWereMadeForProblem"),
                    function () {

                        sharedLibrary.dropFieldState(t, "communicationTabTextInputArea");
                        return;

                    });
            }
        },

        /**
        * Check if text is mandatory for a status
        */
        _isTextMandatoryForStatus: function (sStatusCode) {

            for (var key1 in statusNames) {

                if (sStatusCode == statusNames[key1]) {

                    return statusesWithMandatoryTextComments.statuses.includes(key1);

                }
            }
        },

        /**
        * Get text type for status
        */
        _getTextTypeForStatus: function (sStatusCode) {

            var sTextTypeForStatus = textTypes.internalNote;

            for (var key1 in statusNames) {

                if (sStatusCode == statusNames[key1]) {
                    for (var key2 in textTypesForStatuses) {
                        if (key1 == key2) {

                            sTextTypeForStatus = textTypesForStatuses[key2];
                        }
                    }
                }
            }

            return sTextTypeForStatus;
        },

        /**
       * Upload all incomplete problem attachments at once in a cycle
       */

        _uploadProblemAttachments: function (sGuid, callback) {

            var oUploadSet = this.byId("UploadSet"),
                sAttachmentUploadURL = "/ProblemSet(guid'" + sGuid + "')/Attachment",
                oItems = oUploadSet.getIncompleteItems();

            oUploadSet.setUploadUrl(sharedLibrary.getODataPath(this) + sAttachmentUploadURL);

            for (var k = 0; k < oItems.length; k++) {

                var oItem = oItems[k];
                var sFileName = oItem.getFileName();

                var oCustomerHeaderToken = new sap.ui.core.Item({
                    key: "x-csrf-token",
                    text: this.getModel().getSecurityToken()
                });

                // Header slug to store a file name
                var oCustomerHeaderSlug = new sap.ui.core.Item({
                    key: "slug",
                    text: sFileName
                });

                oUploadSet.addHeaderField(oCustomerHeaderToken);
                oUploadSet.addHeaderField(oCustomerHeaderSlug);
                oUploadSet.uploadItem(oItem);
                oUploadSet.removeAllHeaderFields();
            }

            callback();
        },

        /**
        * Save problem
        */
        _saveProblem: function (oPayload, oTextPayload) {

            var t = this;

            // First step is a specific case when only a single text is entered in non-Customer action statuses,
            // then we have to save it as internal note
            // As NOTE property is related to a Problem SU01 text, we don't send it to backend
            // We are sending an Internal Note SU04 instead of it

            if (("Note" in oPayload) && (Object.keys(oPayload).length == 1)) {

                if (oPayload["Note"].length > 0) {

                    t._createProblemText(t.Guid, oTextPayload.Tdid, oTextPayload.TextString, function () {

                        sap.m.MessageBox.information(t.getResourceBundle().getText("problemUpdatedSuccessfully", t.ObjectId));

                        t._refreshApplicationAndSwitchOffEditMode();
                    });
                }

            } else {

                // Normal update of a problem, Note field is not needed anymore

                oPayload["Note"] = "";

                sharedLibrary.updateEntityByEdmGuidKey(this.Guid, oPayload, "ProblemSet",
                    null, t.getResourceBundle().getText("problemUpdateFailure"), null,
                    t, function () {

                        // Filling problem texts, if required

                        if (oTextPayload.TextString.length > 0) {

                            t._createProblemText(t.Guid, oTextPayload.Tdid, oTextPayload.TextString, function () {

                            });

                        }

                        // Adding attachments

                        t._uploadProblemAttachments(t.Guid, function () {

                            sap.m.MessageBox.information(t.getResourceBundle().getText("problemUpdatedSuccessfully", t.ObjectId));

                            t.byId("UploadSet").getBinding("items").refresh();

                            t._refreshApplicationAndSwitchOffEditMode();

                        });

                    });
            }

        },

        /**
        * Switch off edit mode and refresh texts and view
        */
        _refreshApplicationAndSwitchOffEditMode() {

            // Switching off edit mode

            this._resetEditMode();

            // Refreshing texts

            this._refreshTexts();

            // Refreshing view

            this._refreshView();

        },

        /**
        * Get entered text
        */
        _getTextFieldValue: function () {

            return this.byId("communicationTabTextInputArea").getValue();

        },

        /**
        * Get changed fields
        */
        _getChangedFields: function () {

            var oProblemFieldsInScope = {},
                oProblemChangedFields = [],
                oProblemChangedField = {};

            oProblemFieldsInScope.Status = this.byId("headerStatusSelect").getSelectedKey();
            oProblemFieldsInScope.ProcessorBusinessPartner = this.selectedProcessor;
            oProblemFieldsInScope.Priority = this.byId("headerPrioritySelect").getSelectedKey();

            oProblemFieldsInScope.Note = this._getTextFieldValue();

            var oProblemFieldsInScopeKeys = Object.keys(oProblemFieldsInScope);

            for (var i = 0; i < oProblemFieldsInScopeKeys.length; i++) {

                if (this.initialProblemState[oProblemFieldsInScopeKeys[i]] !== oProblemFieldsInScope[oProblemFieldsInScopeKeys[i]]) {

                    oProblemChangedField[oProblemFieldsInScopeKeys[i]] = oProblemFieldsInScope[oProblemFieldsInScopeKeys[i]];

                    oProblemChangedFields.push(oProblemChangedField);

                    oProblemChangedField = {};

                }
            }

            return oProblemChangedFields;

        },

        /**
         * Get selected processor full name
        */
        _getSelectedProcessorFullName: function () {

            return this.byId('headerProcessorSelect').getValue();

        },
        /**
         * Get selected prioirty text
        */
        _getSelectedPriorityText: function (sPriorityCode) {

            var oPriorityArray = this.byId("headerPrioritySelect").getItems();

            for (var i = 0; i < oPriorityArray.length; i++) {

                if (oPriorityArray[i].getProperty("key") === sPriorityCode) {

                    return oPriorityArray[i].getProperty("text");

                }
            }
        },
        /**
         * Get selected status text
        */
        _getSelectedStatusText: function (sStatusCode) {

            var oStatusArray = this.byId("headerStatusSelect").getItems();

            for (var i = 0; i < oStatusArray.length; i++) {

                if (oStatusArray[i].getProperty("key") === sStatusCode) {

                    return oStatusArray[i].getProperty("text");

                }
            }
        },

        /**
        * Reset edit mode 
        */
        _resetProcessor: function () {

            this.selectedProcessor = '0000000000';
            this.byId("headerProcessorSelect").setValue("");

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
        _storeProblemStateBeforeEdit: function () {

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
