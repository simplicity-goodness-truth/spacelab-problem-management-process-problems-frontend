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

            // Disable drag and drop for UploadSet, as it is 
            // not working properly, when not supported
            // file type/media is supported

            this._disableUploadSetDragAndDrop();

            // Date and time selector trigger property

            this.dateTimeSelectionTrigger;

            // Set IRT SLA manual editing possibility

            this._setIRTSLAManualEditingPossibility();

            // List of attachments before deletion sequence

            this.oListOfAttachmentsBeforeModification = [];

            // Flag that shows that user triggered a file removal at least once

            this.bFileRemovalWasTriggeredAtLeastOnce = false;

            // Getting support teams list from App.controller

            this.oSupportTeamsList = this.getOwnerComponent().getModel("supportTeamsList");

            // Getting frontend constants

            this.oFrontendConstants = this.getOwnerComponent().getModel("frontendConstants");

            // Filling status names constants

            this.statusNames = Object.freeze(this._setStatusNamesConstants());

            // Filling text types constants

            this.textTypes = Object.freeze(this._setTextTypesConstants());

            // Filling text types for statuses constants

            this.textTypesForStatuses = Object.freeze(this._setTextTypesForStatusesConstants());

            // Filling text types of problem creation

            this.textTypesOfProblemCreation = Object.freeze(this._setTextTypesOfProblemCreationConstants());

            // Filling statuses with mandatory text comments

            this.statusesWithMandatoryTextComments = Object.freeze(this._setStatusesWithMandatoryTextCommentsConstants());

            // Filling statuses with possible processor change

            this.statusesWithPossibleProccessorChange = Object.freeze(this._setStatusesWithPossibleProccessorChangeConstants());

        },
        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */

        /**
        * Support team change in processor search dialog
        */
        onChangeSupportTeamSelect: function (oEvent) {

            // Firstly we clear the search field

            sap.ui.getCore().byId("processorSearchDialogSearchField").setValue("");

            // Filtering processors by support team

            this._filterProcessorsTableBasedOnSupportTeam(oEvent.getSource().getSelectedItem().getProperty("text"));

        },

        /**
        * File removal has been pressed
        */
        onFileRemovalPress: function () {


            this.bFileRemovalWasTriggeredAtLeastOnce = true;

        },

        /**
        * Upload completed
        */
        onUploadCompleted: function (oEvent) {
            var oUploadSet = this.byId("problemUploadSet");
            oUploadSet.removeAllIncompleteItems();
            oUploadSet.getBinding("items").refresh();

        },

        /**
        * Date and time have been selected in selector dialog
        */
        onSelectDateTime: function (oEvent) {

            var dSelectedDateTime = this.oDateTimeSelectorDialog.getContent()[0].getItems()[0].getItems()[0].getProperty("dateValue").getTime();

            this._destroyDateTimeDialog();

            this._processSLAManualChange(dSelectedDateTime);

        },

        /**
        * Close date and time selector dialog
        */
        onCloseDateTimeSelectorDialog: function () {

            this._destroyDateTimeDialog();


        },

        /**
        * IRT Manual change is pressed
        */
        onPressIrtManualChange: function () {

            this.dateTimeSelectionTrigger = 'tableProblemDetailsFieldSLAIrtTimestamp';

            this._openDateTimeSelectorDialog();

        },

        /**
        * Communication tab texts are loaded
        */
        onTextsLoaded: function () {

            this._replaceChangeDateIfNeeded();

        },

        /**
        * Selected file extension mismatch
        */
        onFileTypeMismatch: function () {

            sap.m.MessageBox.error(this.getResourceBundle().getText("fileFormatIsNotSupported"));

            var oUploadSet = this.byId("problemUploadSet");
            oUploadSet.removeAllIncompleteItems();

        },

        /**
        * Selected file format mismatch
        */
        onMediaTypeMismatch: function () {

            sap.m.MessageBox.error(this.getResourceBundle().getText("fileFormatIsNotSupported"));

            var oUploadSet = this.byId("problemUploadSet");
            oUploadSet.removeAllIncompleteItems();

        },

        /**
        * Handler for a situation, when file name is pressed in UploadSet
        */
        onFileNamePress: function (oEvent) {

            this._openFileByFileName(oEvent);

        },

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

            // Setting a proper placeholder for a text area

            this._setReplyTextAreaPlaceholderByStatusCode(oEvent.getSource().getSelectedKey());

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

            var sValue = oEvent.getParameter("query"),
                oFilter = [],
                oBinding = sap.ui.getCore().byId("processorSearchDialogTable").getBinding("items");

            if (sValue.length > 0) {

                oFilter.push(new Filter("FullName", FilterOperator.Contains, sValue));

                oBinding.filter(oFilter);

                // Additional search by search tags if no chance to find by name

                if (oBinding.aIndices.length === 0) {

                    oFilter = [];

                    oFilter.push(new Filter("SearchTag1", FilterOperator.Contains, sValue));

                    oBinding.filter(oFilter);
                }

            } else {

                this._filterProcessorsTableBasedOnDefaultSupportTeam();

                sap.ui.getCore().byId("supportTeamSelect").setSelectedKey(this.DefaultProcessingOrgUnit);

            }

        },

        /**
        * Close processor search dialog
        */
        onProcessorSearchDialogClose: function (oEvent) {

            this._destroyProcessorSearchDialog();
        },

        /**
        * Processor chosen in search dialog
        */
        onProcessorSearchDialogChoose: function (oEvent) {

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
            this.TotalProcessingTimeInMinutes = oObject.TotalProcessingTimeInMinutes;
            this.TotalResponseTimeInMinutes = oObject.TotalResponseTimeInMinutes;
            this.DefaultProcessingOrgUnit = oObject.DefaultProcessingOrgUnit;

            this._setAvailableStatuses(oObject.Status);

            this._setProcessorToValueFromEntitySet();

            oViewModel.setProperty("/busy", false);

            this._resetEditMode();

            this._setTotalProcessingTimeValue();

            this._setTotalResponseTimeValue();

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

        /*
        * Set statuses with possible processor change
        */

        _setStatusesWithPossibleProccessorChangeConstants: function () {

            const statuses = [];

            for (var i = 0; i < this.oFrontendConstants.oData.FrontendConstants.results.length; i++) {

                if (this.oFrontendConstants.oData.FrontendConstants.results[i].Class == 'statusesWithPossibleProccessorChange') {

                    statuses.push(this.oFrontendConstants.oData.FrontendConstants.results[i].Value);

                }

            }
            return { 'statuses': statuses };
        },


        /*
        * Set statuses with mandatory text comments
        */

        _setStatusesWithMandatoryTextCommentsConstants: function () {

            const statuses = [];

            for (var i = 0; i < this.oFrontendConstants.oData.FrontendConstants.results.length; i++) {

                if (this.oFrontendConstants.oData.FrontendConstants.results[i].Class == 'statusesWithMandatoryTextComments') {

                    statuses.push(this.oFrontendConstants.oData.FrontendConstants.results[i].Value);

                }

            }
            return { 'statuses': statuses };
        },

        /*
        * Set text types of problem creation constants        
        */

        _setTextTypesOfProblemCreationConstants: function () {

            const textTypes = [];

            for (var i = 0; i < this.oFrontendConstants.oData.FrontendConstants.results.length; i++) {

                if (this.oFrontendConstants.oData.FrontendConstants.results[i].Class == 'textTypesOfProblemCreation') {

                    textTypes.push(this.oFrontendConstants.oData.FrontendConstants.results[i].Value);

                }

            }

            return { 'textTypes': textTypes };

        },

        /*
        * Set text types for statuses constants        
        */

        _setTextTypesForStatusesConstants: function () {

            const textTypesForStatuses = {};

            for (var i = 0; i < this.oFrontendConstants.oData.FrontendConstants.results.length; i++) {

                if (this.oFrontendConstants.oData.FrontendConstants.results[i].Class == 'textTypesForStatuses') {

                    textTypesForStatuses[this.oFrontendConstants.oData.FrontendConstants.results[i].Parameter] = this.oFrontendConstants.oData.FrontendConstants.results[i].Value;

                }

            }

            return textTypesForStatuses;

        },


        /*
        * Set text types constants        
        */

        _setTextTypesConstants: function () {

            const textTypes = {};

            for (var i = 0; i < this.oFrontendConstants.oData.FrontendConstants.results.length; i++) {

                if (this.oFrontendConstants.oData.FrontendConstants.results[i].Class == 'textTypes') {

                    textTypes[this.oFrontendConstants.oData.FrontendConstants.results[i].Parameter] = this.oFrontendConstants.oData.FrontendConstants.results[i].Value;

                }

            }

            return textTypes;

        },

        /*
        * Set status names constants        
        */
        _setStatusNamesConstants: function () {

            const statusNames = {};

            for (var i = 0; i < this.oFrontendConstants.oData.FrontendConstants.results.length; i++) {

                if (this.oFrontendConstants.oData.FrontendConstants.results[i].Class == 'statusNames') {

                    statusNames[this.oFrontendConstants.oData.FrontendConstants.results[i].Parameter] = this.oFrontendConstants.oData.FrontendConstants.results[i].Value;

                }

            }

            return statusNames;

        },

        /**
        * Filter processors based on Support Team
        */
        _filterProcessorsTableBasedOnSupportTeam: function (sSupportTeamText) {

            var sPath = "SearchTag2",
                sOperator = "EQ",
                oBinding = sap.ui.getCore().byId("processorSearchDialogTable").getBinding("items");

            oBinding.filter([new sap.ui.model.Filter(sPath, sOperator, sSupportTeamText)]);

        },

        /**
        * Reload page
        */
        _reloadPage: function () {

            location.reload();
        },

        /**
        * Refresh UploadSet
        */
        _refreshUploadSet: function () {

            var oUploadSet = this.byId("problemUploadSet");

            oUploadSet.removeAllIncompleteItems();

            oUploadSet.getBinding("items").refresh();

        },

        /*
        * Get list of attachments before attachments modification
        */
        getListOfAttachmentsBeforeModification: function () {

            this.oListOfAttachmentsBeforeModification = this.byId("problemUploadSet").getItems();

        },

        /*
        * Get attachments modification on save action (uploading or removal)
        */
        _getAttachmentsModificationOnSaveAction: function () {

            var oAttachmentsToUploadOnBackend = this.byId("problemUploadSet").getIncompleteItems();

            if (this.oListOfAttachmentsBeforeModification && this.oListOfAttachmentsBeforeModification.length) {

                // Getting a list of uploadSet items on a moment of saving (after items are preliminary
                // removed in frontned, but not in a backend)

                var oAttachmentsAfterModification = this.byId("problemUploadSet").getItems()

                // Deleting attachment items on backend which were initially on frontned, but
                // then were removed on frontend

                var oAttachmentsToDeleteOnBackend = this.oListOfAttachmentsBeforeModification.filter(function (val) {
                    return oAttachmentsAfterModification.indexOf(val) == -1;
                });


                return {
                    "attachmentsToDeleteOnBackend": oAttachmentsToDeleteOnBackend,
                    "attachmentsToUploadOnBackend": oAttachmentsToUploadOnBackend
                }

            }

            if (this.oListOfAttachmentsBeforeModification && !this.oListOfAttachmentsBeforeModification.length
                && oAttachmentsToUploadOnBackend && oAttachmentsToUploadOnBackend.length) {

                return {
                    "attachmentsToUploadOnBackend": oAttachmentsToUploadOnBackend
                }

            }


        },

        /*
        * Remove attachments on backend
        */
        _removeAttachmentsOnBackend: function (oAttachmentsToDeleteOnBackend) {

            var sErroneousExecutionText = this.getResourceBundle().getText("problemUpdateFailure"),
                t = this;

            for (var i = 0; i < oAttachmentsToDeleteOnBackend.length; i++) {

                var sAttachmentPointer = oAttachmentsToDeleteOnBackend[i].getBindingContext().sPath

                sharedLibrary.removeEntity(sAttachmentPointer, sErroneousExecutionText, this, false, true, function () {

                    // Whole page reload is required, otherwise
                    // UploadSet throwns a "duplicate id" error for a deleted UploadSet item

                    t._reloadPage();

                })

            }
        },

        /*
        * Get application configuration parameters
        */
        _getApplicationConfigurationParameters: function () {

            var oApplicationConfiguration = this.getOwnerComponent().getModel("applicationConfiguration");
            return oApplicationConfiguration.oData.ApplicationConfiguration.results;

        },

        /*
        * Set IRT SLA manual editing possibility 
        */
        _setIRTSLAManualEditingPossibility: function () {

            var t = this,
                oApplicationConfigurationParameters = this._getApplicationConfigurationParameters(),
                oIRTSLAModel = new JSONModel({
                    manualEditPossibility: false
                });

            // Getting data from configuration

            for (var i = 0; i < oApplicationConfigurationParameters.length; i++) {

                if ((oApplicationConfigurationParameters[i].Param.indexOf('PROCESSPROBLEM_SLA_IRT_MANUAL_EDIT') > 0) &&
                    (oApplicationConfigurationParameters[i].Value === 'X')) {

                    oIRTSLAModel.oData.manualEditPossibility = true;

                }
            }
            this.byId("buttonChangeIRTManually").setModel(oIRTSLAModel, "IRTSLAModel");
        },

        /**
        * Process manual SLA change
        */
        _processSLAManualChange: function (dSelectedDateTime) {

            var t = this;
            if (dSelectedDateTime) {

                switch (this.dateTimeSelectionTrigger) {

                    case "tableProblemDetailsFieldSLAIrtTimestamp":

                        // IRT SLA has been changed manually 

                        var oPayload = {},
                            oTextPayload = {};

                        oPayload.InputTimestamp = new Date(dSelectedDateTime);
                        oPayload.SLAIrtStatus = 'MANCH';

                        t._saveProblem(oPayload, oTextPayload);

                        break;

                    default:
                        break;
                }


            }

        },

        /**
        * Open date and time selector dialog
        */
        _openDateTimeSelectorDialog: function () {

            this.oDateTimeSelectorDialog = sap.ui.xmlfragment("zslpmprprb.view.DateTimeSelector", this);

            this.getView().addDependent(this.oDateTimeSelectorDialog);

            this.oDateTimeSelectorDialog.open();


        },

        /*
        * Set total processing time value
        */

        _setTotalProcessingTimeValue: function () {

           //  var sProcTimeText;

            if (this.TotalProcessingTimeInMinutes > 0) {

                // var totalProcessingTimeHours = Math.floor(this.TotalProcessingTimeInMinutes / 60),
                //     totalProcessingTimeMinutes = this.TotalProcessingTimeInMinutes % 60;

                // sProcTimeText = totalProcessingTimeHours + " " + this.getResourceBundle().getText("hours") + " " +
                //     totalProcessingTimeMinutes + " " + this.getResourceBundle().getText("minutes");

                // Setting processing time for statistics

                var t = this;

                this.byId("problemTimeMeasurementsTableTotalProcTime").setText(
                    t.formatter.secondsParsedToDaysHoursMinutesSeconds(t.TotalProcessingTimeInMinutes * 60, t)
                );

            } 
            
            // else {
            //     sProcTimeText = "0" + " " + this.getResourceBundle().getText("hours") + " " +
            //         "0" + " " + this.getResourceBundle().getText("minutes");
            // }

           // this.byId("tableProblemDetailsFieldTotalProcTime").setText(sProcTimeText);

        },

        /*
       * Set total response time value
       */

        _setTotalResponseTimeValue: function () {

            if (this.TotalResponseTimeInMinutes > 0) {

                // Setting processing time for statistics

                var t = this;

                this.byId("problemTimeMeasurementsTableTotalResponseTime").setText(
                    t.formatter.secondsParsedToDaysHoursMinutesSeconds(t.TotalResponseTimeInMinutes * 60, t)
                );

            } 

        },

        /*
        * Disable drag and drop function for UploadSet
        */
        _disableUploadSetDragAndDrop: function () {

            this.getView().byId("problemUploadSet").addDelegate({
                ondragenter: function (oEvent) {
                    oEvent.stopPropagation()
                },
                ondragover: function (oEvent) {
                    oEvent.stopPropagation()
                },
                ondrop: function (oEvent) {
                    oEvent.stopPropagation()
                }
            }, true);

        },

        /**
        * Set reply text area placeholder depending on status
        */

        _setReplyTextAreaPlaceholderByStatusCode: function (sStatusCode) {

            if (this._isTextMandatoryForStatus(sStatusCode)) {

                this.byId("communicationTabTextInputArea").setPlaceholder(this.getResourceBundle().getText("enterCustomerReplyText"));

            } else {
                this.byId("communicationTabTextInputArea").setPlaceholder(this.getResourceBundle().getText("enterReplyText"));

            }


        },

        /**
        * Check, if change date replacement is required
        */
        _isChangeDateReplacementNeeded: function () {

            var t = this;

            // Normally during a creation of a problem we firstly fill all mandatory CRMD_ORDERADM_H and CRMD_CUSTOMER_H
            // fields with first POST execution and then we pass texts for business impacts, contact etc
            // via separated POST method.
            // That is why change date is always greater than creation date even after a simple fact of creation.
            // To avoid misunderstanding we will make change date = creation date when problem is in NEW status,
            // there is no processor assigned, and there are no REPLY (SU01) texts

            if ((this.Status == this._getStatusCode("new")) && !this.ProcessorFullName) {

                var oTextItems = this.byId("textsList").getItems(),
                    bOnlyMandatoryTextsAreEntered = true,
                    oView = this.getView(),
                    oElementBinding = oView.getElementBinding(),
                    t = this;

                for (var i = 0; i < oTextItems.length; i++) {

                    var sPath = oTextItems[i].getBindingContext().getPath(),
                        oText = oView.getModel().getObject(sPath);

                    if (t.textTypesOfProblemCreation.textTypes.indexOf(this._getTextTypeByCode(oText.Tdid)) == '-1') {

                        bOnlyMandatoryTextsAreEntered = false;
                        break;

                    }
                }

                if (bOnlyMandatoryTextsAreEntered) {

                    t.byId("tableProblemDetailsFieldChangeDate").setText(t.byId("tableProblemDetailsFieldCreationDate").getText());

                }

            }

        },

        /**
        * Replace change date, if required
        */
        _replaceChangeDateIfNeeded: function () {

            this._isChangeDateReplacementNeeded();

        },

        /**
        * Get text type name by code 
        */
        _getTextTypeByCode: function (sTextCode) {

            var t = this;

            for (var key in t.textTypes) {

                if (sTextCode == t.textTypes[key]) {

                    return key;
                }

            }

        },

        /*
        * Get status code
        */
        _getStatusCode: function (sStatusName) {

            var t = this;

            for (var key in t.statusNames) {

                if (sStatusName == key) {

                    return t.statusNames[key];

                }
            }
        },

        /**
        * Open attachment file by name
        */
        _openFileByFileName(oEvent) {

            var attachmentPointer = oEvent.getSource().getBindingContext().sPath + "/$value",
                fullFilePathUrl = sharedLibrary.getODataPath(this) + attachmentPointer,
                fullFilePathUrlFixed = sharedLibrary.validateAndFixUrl(fullFilePathUrl), item = oEvent.getParameter("item");

            // Initial url property of item of UploadSet is set to documentId and cannot be reached from a browser
            // However, initially we still need url property set, as without it a file name will not be clickable
            // Approach: replacing url property of a UploadSet item to a proper URL of an attachment

            item.setProperty("url", fullFilePathUrlFixed);

        },

        /**
       * Return a problem from Withdrawn to In Process
       */
        _returnFromWithdrawal: function () {

            var sText = this.getResourceBundle().getText("confirmReturnFromWithdrawal"),
                t = this,
                oPayload = {};

            oPayload.Status = t.statusNames.inProcess;

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

            for (var key1 in t.statusNames) {

                if (sStatusCode == t.statusNames[key1]) {

                    if (t.statusesWithPossibleProccessorChange.statuses.includes(key1)) {

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

            // ------- Old implementation for SelectDialog -----------

            // var aContexts = oEvent.getParameter("selectedContexts"),
            //     t = this;

            // // Something was selected

            // if (aContexts && aContexts.length) {

            //     var selectedValue = aContexts.map(function (oContext) {
            //         return oContext.getObject().FullName;
            //     }).join(", "),
            //         selectedCode = aContexts.map(function (oContext) {
            //             return oContext.getObject().BusinessPartner;
            //         }).join(", ");

            //     // Setting values of a specified control and storing selected code

            //     t.byId('headerProcessorSelect').setValue(selectedValue);

            //     t.selectedProcessor = selectedCode;

            // }           

            // oEvent.getSource().getBinding("items").filter([]);

            // ------- New implementation for Table -----------

            var t = this;

            t.selectedProcessor = oEvent.getSource().getCells()[0].getText();
            t.byId('headerProcessorSelect').setValue(oEvent.getSource().getCells()[1].getText());

        },

        /**
        * Destroy date and time selector
        */

        _destroyDateTimeDialog: function () {

            this.oDateTimeSelectorDialog.destroy(true);

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

            // Remove incompleted uploads from UploadSet

            var oUploadSet = this.byId("problemUploadSet");
            oUploadSet.removeAllIncompleteItems();

            // We have to reload a whole page to avoid duplicate item ids error for UploadSet
            // for a case, when a user confirmed a file removal, but then for a some reason
            // switched an edit mode off

            if (this.bFileRemovalWasTriggeredAtLeastOnce) {

                this._reloadPage();

                this.bFileRemovalWasTriggeredAtLeastOnce = false;
            }

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

            sap.ui.getCore().byId("processorSearchDialog").setModel(this.oSupportTeamsList, "supportTeamsSearchModel");

            // Filtering processors according to a default processing unit      

            this._filterProcessorsTableBasedOnDefaultSupportTeam();

        },

        /**
        * Filter processors based on a default support team
        */
        _filterProcessorsTableBasedOnDefaultSupportTeam: function () {


            for (var i = 0; i < this.oSupportTeamsList.oData.SupportTeamsList.length; i++) {

                if (this.oSupportTeamsList.oData.SupportTeamsList[i].OrgUnitNumber === this.DefaultProcessingOrgUnit) {

                    var sSupportTeamName = this.oSupportTeamsList.oData.SupportTeamsList[i].Name;

                    this._filterProcessorsTableBasedOnSupportTeam(sSupportTeamName);

                    return;

                }
            }
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
                sNewStatus,
                oAttachmentsToDelete = [];

            if (oChangedFields.length > 0) {

                var sListOfChangedFields,
                    sSaveConfirmationMessage = t.getResourceBundle().getText("confirmProblemSavingWithChangedFields");

                for (var k = 0; k < oChangedFields.length; k++) {

                    var oChangedFieldsKeys = Object.keys(oChangedFields[k]);

                    for (var i = 0; i < oChangedFieldsKeys.length; i++) {

                        sSelectedTextValue = "";

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

                            case 'attachmentsToDelete':

                                sFieldName = t.getResourceBundle().getText("removedAttachmentsCount");

                                sSelectedTextValue = oChangedFields[k][oChangedFieldsKeys[i]].length;

                                oAttachmentsToDelete = oChangedFields[k][oChangedFieldsKeys[i]];

                                break;

                            case 'attachmentsToUpload':

                                sFieldName = t.getResourceBundle().getText("uploadedAttachmentsCount");

                                sSelectedTextValue = oChangedFields[k][oChangedFieldsKeys[i]].length;

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

                        // Should not put attachments related fields into payload

                        if (oChangedFieldsKeys[i].indexOf("attachments") == -1) {
                            oPayload[oChangedFieldsKeys[i]] = oChangedFields[k][oChangedFieldsKeys[i]];
                        }

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

                        // Finally removing attachments from a server

                        if (oAttachmentsToDelete.length > 0) {

                            t._removeAttachmentsOnBackend(oAttachmentsToDelete);

                        }
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

            var t = this;

            for (var key1 in t.statusNames) {

                if (sStatusCode == t.statusNames[key1]) {

                    return t.statusesWithMandatoryTextComments.statuses.includes(key1);

                }
            }
        },

        /**
        * Get text type for status
        */
        _getTextTypeForStatus: function (sStatusCode) {

            var t = this,
                sTextTypeForStatus = t.textTypes.internalNote;

            for (var key1 in t.statusNames) {

                if (sStatusCode == t.statusNames[key1]) {
                    for (var key2 in t.textTypesForStatuses) {
                        if (key1 == key2) {

                            sTextTypeForStatus = t.textTypesForStatuses[key2];
                        }
                    }
                }
            }

            return sTextTypeForStatus;
        },

        /**
       * Upload all incomplete problem attachments at once in a cycle
       */

        _uploadProblemAttachments: function (sGuid, bInternal, callback) {

            var oUploadSet = this.byId("problemUploadSet"),
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
                    text: encodeURIComponent(sFileName)
                });

                if (bInternal) {

                    // Header to store internal visibility

                    var oCustomerHeaderVisibility = new sap.ui.core.Item({
                        key: "visibility",
                        text: "I"
                    });

                }

                oUploadSet.addHeaderField(oCustomerHeaderToken);
                oUploadSet.addHeaderField(oCustomerHeaderSlug);

                if (bInternal) {

                    // Header to store internal visibility

                    oUploadSet.addHeaderField(oCustomerHeaderVisibility);

                }

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


                        t._uploadProblemAttachments(t.Guid, true, function () {


                            sap.m.MessageBox.information(t.getResourceBundle().getText("problemUpdatedSuccessfully", t.ObjectId));

                            t._refreshApplicationAndSwitchOffEditMode();

                        });


                    });
                }

            } else {

                // Normal update of a problem, Note field is not needed anymore

                oPayload["Note"] = "";

                sharedLibrary.updateEntityByEdmGuidKey(this.Guid, oPayload, "ProblemSet",
                    null, t.getResourceBundle().getText("problemUpdateFailure"), null,
                    t, function () {

                        // Filling problem texts, if required

                        if ((oTextPayload.TextString) && (oTextPayload.TextString.length > 0)) {

                            t._createProblemText(t.Guid, oTextPayload.Tdid, oTextPayload.TextString, function () {

                            });

                        }

                        // Adding attachments

                        t._uploadProblemAttachments(t.Guid, false, function () {

                            sap.m.MessageBox.information(t.getResourceBundle().getText("problemUpdatedSuccessfully", t.ObjectId));

                            t.byId("problemUploadSet").getBinding("items").refresh();

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

            // Refreshing attachments

            this._refreshUploadSet();

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

            // Generic fields block

            for (var i = 0; i < oProblemFieldsInScopeKeys.length; i++) {

                if (this.initialProblemState[oProblemFieldsInScopeKeys[i]] !== oProblemFieldsInScope[oProblemFieldsInScopeKeys[i]]) {

                    oProblemChangedField[oProblemFieldsInScopeKeys[i]] = oProblemFieldsInScope[oProblemFieldsInScopeKeys[i]];

                    oProblemChangedFields.push(oProblemChangedField);

                    oProblemChangedField = {};

                }
            }

            // Attachments block

            var oAttachmentsModificationOnSaveAction = this._getAttachmentsModificationOnSaveAction();

            var oAttachmentsToDelete = [];
            var oAttachmentsToUpload = [];

            // Attachments deletion has been performed

            if (oAttachmentsModificationOnSaveAction && oAttachmentsModificationOnSaveAction.attachmentsToDeleteOnBackend && (oAttachmentsModificationOnSaveAction.attachmentsToDeleteOnBackend.length > 0)) {

                oAttachmentsModificationOnSaveAction.attachmentsToDeleteOnBackend.forEach(function (value, index, array) {

                    oAttachmentsToDelete.push(value);

                });
            }

            if (oAttachmentsToDelete.length > 0) {

                oProblemChangedFields.push(

                    {
                        "attachmentsToDelete": oAttachmentsToDelete
                    });
            }

            // Attachments upload has been performed

            if (oAttachmentsModificationOnSaveAction && oAttachmentsModificationOnSaveAction.attachmentsToUploadOnBackend && (oAttachmentsModificationOnSaveAction.attachmentsToUploadOnBackend.length > 0)) {

                oAttachmentsModificationOnSaveAction.attachmentsToUploadOnBackend.forEach(function (value, index, array) {

                    oAttachmentsToUpload.push(value);

                });

            }

            if (oAttachmentsToUpload.length > 0) {

                oProblemChangedFields.push(

                    {
                        "attachmentsToUpload": oAttachmentsToUpload
                    });
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

            // Resetting a list of attachments

            this.oListOfAttachmentsBeforeModification = [];
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

            // Getting a list of attachments

            this.getListOfAttachmentsBeforeModification();

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
