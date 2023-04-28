sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/library",
    "sap/ui/export/Spreadsheet",
    "../utils/sharedLibrary",
    "sap/ui/model/Sorter"
], function (BaseController, JSONModel, formatter, Filter, FilterOperator, exportLibrary, Spreadsheet, sharedLibrary, Sorter) {
    "use strict";

    return BaseController.extend("zslpmprprb.controller.Worklist", {

        formatter: formatter,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        /**
         * Called when the worklist controller is instantiated.
         * @public
         */
        onInit: function () {
            var oViewModel;

            // keeps the search state
            this._aTableSearchState = [];

            // Model used to manipulate control states
            oViewModel = new JSONModel({
                worklistTableTitle: this.getResourceBundle().getText("worklistTableTitle"),
                shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
                shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
                tableNoDataText: this.getResourceBundle().getText("tableNoDataText")
            });

            this.setModel(oViewModel, "worklistView");

            // Getting  execution context from App.controller

            var oExecutionContext = this.getOwnerComponent().getModel("executionContext");

            // Current system user              

            this.oSystemUser = oExecutionContext.oData;

            // --------------------------------------------
            // Table sorting  preparation
            // --------------------------------------------

            var oTable = this.byId("problemsTable");
            // Listener on header click

            var t = this;

            oTable.addEventDelegate({
                onAfterRendering: function () {
                    var oHeader = this.$().find(".sapMListTblHeaderCell"); //Get hold of table header elements

                    for (var i = 0; i < oHeader.length; i++) {
                        var oID = oHeader[i].id;
                        t.onHeaderClick(oID);
                    }
                }
            }, oTable);

            // Link to Sorting options fragment

            if (!this.oSortingResponsivePopover) {
                
                this.oSortingResponsivePopover = sap.ui.xmlfragment("zslpmprprb.view.Sorting", this);
                this.getView().addDependent(this.oSortingResponsivePopover);
            }

            // Array of filters supporting sorting

            this.oColumnsSupportingSorting = [];
            this._prepareColumnsSupportingSorting();

            // Column selected for sorting

            this.columnSelectedForSorting;

        },

        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */

        /**
         * Sort column ascending
        */
        onSortAscending: function () {

            this._sortProblemsTableColumn(false);
        },

        /**
        * Sort column descending
        */
        onSortDescending: function () {

            this._sortProblemsTableColumn(true);
        },

        /**
         * Click on header table performed
        */
        onHeaderClick: function (oID) {

            var t = this,
                oTable = this.byId("problemsTable");

            $("#" + oID).click(function (oEvent) { //Attach Table Header Element Event

                var oTarget = oEvent.currentTarget; //Get hold of Header Element

                var oLabelText = oTarget.childNodes[0].textContent; //Get Column Header text

                if (JSON.stringify(t.oColumnsSupportingSorting).includes(oLabelText)) {

                    // Displaying pop-up for sorting if there are records in table

                    if (oTable.getBinding("items").getLength() > 0) {

                        t.oSortingResponsivePopover.openBy(oTarget);

                        t.columnSelectedForSorting = oLabelText;

                    } // if (oLabelText === t.getResourceBundle().getText("vendorScore"))

                } // if (oLabelText === t.getResourceBundle().getText("vendorScore"))

            });

        },

        /**
         * Export to Excel pressed
        */

        onPressExportToExcel: function (oEvent) {

            var oTable = this.byId('problemsTable');

            sharedLibrary.exportTableToExcel(oTable, this._sServiceUrl, 'Problems.xlsx');

        },

        /**
         * Triggered by the table's 'updateFinished' event: after new table
         * data is available, this handler method updates the table counter.
         * This should only happen if the update was successful, which is
         * why this handler is attached to 'updateFinished' and not to the
         * table's list binding's 'dataReceived' method.
         * @param {sap.ui.base.Event} oEvent the update finished event
         * @public
         */
        onUpdateFinished: function (oEvent) {
            // update the worklist's object counter after the table update
            var sTitle,
                oTable = oEvent.getSource(),
                iTotalItems = oEvent.getParameter("total");
            // only update the counter if the length is final and
            // the table is not empty
            if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
                sTitle = this.getResourceBundle().getText("worklistTableTitleCount", [iTotalItems]);
            } else {
                sTitle = this.getResourceBundle().getText("worklistTableTitle");
            }
            this.getModel("worklistView").setProperty("/worklistTableTitle", sTitle);
        },

        /**
         * Event handler when a table item gets pressed
         * @param {sap.ui.base.Event} oEvent the table selectionChange event
         * @public
         */
        onPress: function (oEvent) {
            // The source is the list item that got pressed
            this._showObject(oEvent.getSource());
        },

        /**
         * Event handler for navigating back.
         * Navigate back in the browser history
         * @public
         */
        onNavBack: function () {
            // eslint-disable-next-line sap-no-history-manipulation
            history.go(-1);
        },

        /**
         * Filter search executed
        */
        onSearch: function (oEvent) {


            var aTableSearchState = [];

            // Picking all selected items from multi-selectional filters

            var oMultipleSelectionFilters = [
                {
                    filterName: "priorityFilter",
                    propertyName: "Priority"
                },
                {
                    filterName: "statusFilter",
                    propertyName: "Status"
                },
                {
                    filterName: "companyFilter",
                    propertyName: "CompanyBusinessPartner"
                },
                {
                    filterName: "processorFilter",
                    propertyName: "ProcessorBusinessPartner"
                }
            ];

            aTableSearchState = this._fillFilterForMultipleSelection(oMultipleSelectionFilters);

            // Filter by dates

            var dateFrom = this.getView().byId("dateRangeSelector").getDateValue();
            var dateTo = this.getView().byId("dateRangeSelector").getSecondDateValue();

            if (dateFrom && dateTo) {

                var D = new Date(dateFrom);
                var t = D.getTimezoneOffset();
                D.setMinutes(D.getMinutes() - t);

                var e = new Date(dateTo);
                e.setMinutes(e.getMinutes() - t);

                aTableSearchState.push(new Filter("PostingDate", FilterOperator.BT, D, e));

            }


            this._applySearch(aTableSearchState);


        },

        /**
         * Event handler for refresh event. Keeps filter, sort
         * and group settings and refreshes the list binding.
         * @public
         */
        onRefresh: function () {
            var oTable = this.byId("problemsTable");
            oTable.getBinding("items").refresh();
        },

        /* =========================================================== */
        /* internal methods                                            */
        /* =========================================================== */

        /**
         * Prepare array of columns, supporting sorting
        */

        _prepareColumnsSupportingSorting: function () {

            // Array of columns supporting sorting

            this.oColumnsSupportingSorting.push({
                id: this.getResourceBundle().getText("problemNumberTitle"),
                field: "ObjectId"
            });

            this.oColumnsSupportingSorting.push({
                id: this.getResourceBundle().getText("problemPriorityTitle"),
                field: "PriorityText"
            });

            this.oColumnsSupportingSorting.push({
                id: this.getResourceBundle().getText("problemStatusTitle"),
                field: "StatusText"
            });


            this.oColumnsSupportingSorting.push({
                id: this.getResourceBundle().getText("postingDateTitle"),
                field: "PostingDate"
            });


        },

        /**
        * Sort problems table column
        */
        _sortProblemsTableColumn: function (bDescending) {

            var t = this;

            for (var i in this.oColumnsSupportingSorting) {

                if (this.oColumnsSupportingSorting[i].id == this.columnSelectedForSorting) {

                    var sPath = t.oColumnsSupportingSorting[i].field;

                    var oSorter = new Sorter({
                        path: sPath,
                        descending: bDescending
                    });

                    var oTable = t.getView().byId("problemsTable");

                    oTable.getBinding("items").sort(oSorter);
                    t.oSortingResponsivePopover.close();

                }
            }
        },


        /**
         * Fill filter for multiple selection
        */
        _fillFilterForMultipleSelection: function (oMultipleSelectionFilters) {

            var oOutputFilter = [],
                t = this;

            $.each(oMultipleSelectionFilters, function (i) {

                var sFilterName = oMultipleSelectionFilters[i].filterName;
                var sPropertyName = oMultipleSelectionFilters[i].propertyName;

                var oFilter = t.getView().byId(sFilterName);

                if (oFilter) {
                    var oSelectedKeys = oFilter.getSelectedKeys();

                    $.each(oSelectedKeys, function (j) {

                        oOutputFilter.push(
                            new Filter({
                                path: sPropertyName,
                                operator: sap.ui.model.FilterOperator.EQ,
                                value1: oSelectedKeys[j]
                            }));

                    }); // $.each(oSelectedKeys, function (j)

                } // if (oFilter)

            }); // $.each(oMultipleSelectionFilters, function (i)

            return oOutputFilter;
        },

        /**
         * Shows the selected item on the object page
         * @param {sap.m.ObjectListItem} oItem selected Item
         * @private
         */
        _showObject: function (oItem) {
            this.getRouter().navTo("object", {
                objectId: oItem.getBindingContext().getPath().substring("/ProblemSet".length)
            });
        },

        /**
         * Internal helper method to apply both filter and search state together on the list binding
         * @param {sap.ui.model.Filter[]} aTableSearchState An array of filters for the search
         * @private
         */
        _applySearch: function (aTableSearchState) {
            var oTable = this.byId("problemsTable"),
                oViewModel = this.getModel("worklistView");
            oTable.getBinding("items").filter(aTableSearchState, "Application");
            // changes the noDataText of the list in case there are no filter results
            if (aTableSearchState.length !== 0) {
                oViewModel.setProperty("/tableNoDataText", this.getResourceBundle().getText("worklistNoDataWithSearchText"));
            }
        }

    });
});
