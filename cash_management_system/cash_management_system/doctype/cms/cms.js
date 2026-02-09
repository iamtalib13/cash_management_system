frappe.ui.form.on("CMS", {
  onload: function (frm) {
    // If the form is new, refresh the window
    // if (frm.is_new()) {
    //   window.location.reload(); // Refreshes the page
    // }

    frm.set_query("bank_name", "cheque_details", function (doc, cdt, cdn) {
      return {
        filters: {
          branch: frm.doc.sol_id, // Assuming sol_id is the field in CMS that links to Employee's branch
        },
      };
    });
    frm.trigger("custodian_1_filter");
    frm.trigger("custodian_2_filter");
    frappe.call({
      method: "frappe.client.get_value",
      args: {
        doctype: "Employee",
        filters: { user_id: frappe.session.user },
        fieldname: ["designation"],
      },
      callback: function (r) {
        frm._user_designation = (r.message?.designation || "")
          .toUpperCase()
          .trim();
        console.log("User Designation:", frm._user_designation);

        // ✅ run access check and role validation ONLY after designation is available
        apply_page_access_control(frm);
        frm.trigger("role_validation");
      },
    });
    frm.set_query("bank_name", "cheque_details", function (doc, cdt, cdn) {
      return {
        filters: {
          branch: frm.doc.sol_id, // This now has the correct value
        },
      };
    });
  },
  validate: function (frm) {
    //frm.trigger("check_mandatory_child");
  },

  refresh: function (frm) {
    console.log("refresh fired"); // Add to refresh() for debugging

    //frm.trigger("transaction_category");
    frm.trigger("transaction_type");

    // frm.trigger("home_button");
    if (frm._user_designation) {
      frm.trigger("role_validation");
    }
    frm.trigger("role_check");
    frm.trigger("section_colors");
    $("span.sidebar-toggle-btn").hide();
    $(".col-lg-2.layout-side-section").hide();
    frm.trigger("populate_employee_html");

    console.log("neww");

    if (frm.is_new()) {
      frm.trigger("show_employee");
      frm.trigger("set_branch");
      frm.trigger("set_request_date_time");
    } else if (!frm.is_new()) {
      frm.trigger("custodian_1");
      frm.trigger("custodian_2");
      frm.trigger("show_employee");
      frm.trigger("show_approval_tracker");
    }
    if (frappe.session.user === "Administrator") {
      frm.enable_save();
      frm.trigger("creator_submit_btn");

      return;
    }
    // if (frm.doc.docstatus === 0 && !frm.is_new()) {
    //   frm.trigger("creator_submit_btn");
    // }
    // Only for CIT transactions
    if (frm.doc.transaction_category !== "CIT") return;
    if (frm.doc.stage_2_emp_status !== "Approved") return;

    // Do not show if already acknowledged
    if (frm.doc.acknowledged) return;
    // Add ACK button
    frm.add_custom_button(__("CIT Cash Reached"), function () {
      frappe.confirm(
        "Confirm that CIT cash has safely reached the destination?",
        function () {
          send_cit_ack(frm);
          // this is just a button showing cdoe sending acknowledgement frappe call is below
        },
      );
    });
  },
  // home_button: function (frm) {
  //   frm.add_custom_button(__("Home"), function () {
  //     // Add your function logic here
  //     window.location.href = "/policies#cms";
  //   });
  //   frm.change_custom_button_type("Home", null, "#000000"); // Corrected to a valid hex color code
  // },

  transaction_category: function (frm) {
    if (frm.doc.transaction_category !== "CIT") {
      frm.set_value("requested_branch", null);
      frm.set_value("transaction_type", null);
      frm.set_value("select_branch", null);

      frm.refresh_field("requested_branch");
      frm.refresh_field("transaction_type");
      frm.refresh_field("select_branch");
    }
    if (frm.doc.transaction_category === "DEPOSIT") {
      frm.fields_dict["cheque_details"].grid.grid_rows.forEach((row) => {
        row.grid.toggle_enable("cheque_number", false);
      });
    } else {
      frm.fields_dict["cheque_details"].grid.grid_rows.forEach((row) => {
        row.grid.toggle_enable("cheque_number", true);
      });
    }
  },

  role_validation: function (frm) {
    const user = frappe.session.user;

    // --- Admin hard exit ---
    if (user === "Administrator") {
      frm._cms_role = "Administrator";
      frm.enable_save();
      frm.trigger("creator_submit_btn");
      return;
    }

    const requesterDesignations = [
      "ASST. BRANCH MANAGER",
      "BRANCH OFFICER",
      "BRANCH MANAGER",
      "BRANCH OPERATION MANAGER",
      "CUSTOMER SERVICE OFFICER",
      "CUSTOMER SERVICE MANAGER",
    ];

    const comDesignations = [
      "CLUSTER OPERATION MANAGER",
      "REGIONAL OPERATION MANAGER",
      "ASST. ZONAL MANAGER",
      "ZONAL MANAGER",
    ];

    let role = null;
    const userDesig = (frm._user_designation || "").toUpperCase().trim();

    // 1. Check Designation for Requester
    if (requesterDesignations.some((d) => userDesig.includes(d))) {
      role = "Requester";
    }
    // 2. Check Designation for COM Approver
    else if (comDesignations.some((d) => userDesig.includes(d))) {
      role = "COM-Approver";
    }
    // 3. Hardcoded HO Approver by User ID
    else if (user === "813@sahayog.com") {
      role = "HO-Approver";
    }

    frm._cms_role = role;
    console.log("CMS ROLE RESOLVED:", role);

    // --------------------------------------------------
    // REQUESTER
    // --------------------------------------------------
    if (role === "Requester") {
      // ✅ Show Submit ONLY when status is Draft
      if (frm.doc.status === "Draft") {
        frm.trigger("creator_submit_btn");
      } else {
        // ❌ Hide Submit in all other states
        frm.remove_custom_button("Submit");
        frm.disable_save();
      }

      if (frm.doc.status === "Approved") {
        frm.trigger("requester_intro");
        frm.trigger("upload_attach");
      }

      frm.trigger("creator_show_intro");
      frm.set_df_property("approved_movement_charges", "read_only", 1);
    }

    // --------------------------------------------------
    // COM APPROVER ✅
    // --------------------------------------------------
    else if (role === "COM-Approver") {
      frm.disable_save(); // only save, NOT form
      frm.trigger("com_read_only");
      frm.trigger("com_show_intro");

      if (
        frm.doc.stage_1_emp_status === "Pending" ||
        frm.doc.stage_1_emp_status === "Rejected"
      ) {
        frm.trigger("com_buttons");
      }
    }

    // --------------------------------------------------
    // HO APPROVER
    // --------------------------------------------------
    else if (role === "HO-Approver") {
      frm.disable_save();
      frm.trigger("ho_read_only");
      frm.trigger("ho_show_intro");

      if (
        frm.doc.stage_2_emp_status === "Pending" ||
        frm.doc.stage_2_emp_status === "Rejected"
      ) {
        frm.trigger("ho_buttons");
        frm.trigger("ho_intro");
      }
    }

    // --------------------------------------------------
    // SYSTEM MANAGER
    // --------------------------------------------------
    else if (frappe.user.has_role("System Manager")) {
      frm.enable_save();
    }

    // --------------------------------------------------
    // OTHERS
    // --------------------------------------------------
    else {
      // frm.disable_form();
      frm.disable_save();
    }
  },
  upload_attach: function (frm) {
    // Add custom button

    if (
      !frm.doc.transaction_receipt &&
      frm.doc.transaction_category !== "CIT"
    ) {
      frm.add_custom_button("Upload Receipt", function () {
        // Create a dialog
        let dialog = new frappe.ui.Dialog({
          title: "Upload Transaction Receipt",
          fields: [
            {
              fieldname: "receipt_attachment",
              fieldtype: "Attach",
              label: "Transaction Receipt",
              reqd: 1,
            },
          ],
          primary_action_label: "Upload",
          primary_action: function () {
            let values = dialog.get_values();
            if (values) {
              // Save the file to the field
              frm.set_value("transaction_receipt", values.receipt_attachment);
              // preserve_child_tables(frm);

              frm.save();
              dialog.hide();
              frappe.msgprint(__("Transaction Receipt uploaded successfully."));
            }
          },
        });
        dialog.show();
      });
    }
  },

  requester_intro: function (frm) {
    let transaction_category = frm.doc.transaction_category.toLowerCase();
    frm.set_intro(
      '<span style="font-size: 15px; display: flex; align-items: center;">' +
        '<span style="width: 20px; height: 20px; background-color: #66AB63; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 5px;">' +
        '<span style="color: white;">&#10003;</span>' + // Checkmark symbol
        "</span>" +
        " Your " +
        transaction_category.toLowerCase() +
        " request has been Approved. You may now proceed to make the " +
        transaction_category.toLowerCase() +
        ".</span>",
      "green",
    );
  },
  ho_read_only: function (frm) {
    frm.set_df_property("approved_movement_charges", "read_only", 0);
    frm.set_df_property("transaction_category", "read_only", 1);
    frm.set_df_property("date_of_transaction", "read_only", 1);
    frm.set_df_property("amount", "read_only", 1);

    frm.set_df_property("bank_name", "read_only", 1);
    frm.set_df_property("ifsc_code", "read_only", 1);
    frm.set_df_property("account_number", "read_only", 1);
    frm.set_df_property("cheque_number", "read_only", 1);

    frm.set_df_property("custodian_1", "read_only", 1);
    frm.set_df_property("custodian_2", "read_only", 1);

    frm.set_df_property("branch_distance_km", "read_only", 1);
    frm.set_df_property("requested_movement_changes", "read_only", 1);
    frm.set_df_property("cheque_details", "read_only", 1);
  },
  com_read_only: function (frm) {
    frm.set_df_property("approved_movement_charges", "read_only", 1);
    frm.set_df_property("transaction_category", "read_only", 1);
    frm.set_df_property("date_of_transaction", "read_only", 1);
    frm.set_df_property("amount", "read_only", 1);

    frm.set_df_property("bank_name", "read_only", 1);
    frm.set_df_property("ifsc_code", "read_only", 1);
    frm.set_df_property("account_number", "read_only", 1);
    frm.set_df_property("cheque_number", "read_only", 1);

    frm.set_df_property("custodian_1", "read_only", 1);
    frm.set_df_property("custodian_2", "read_only", 1);

    frm.set_df_property("branch_distance_km", "read_only", 1);
    frm.set_df_property("requested_movement_changes", "read_only", 1);
    frm.set_df_property("cheque_details", "read_only", 1);
  },

  creator_show_intro: function (frm) {
    let transaction_category = frm.doc.transaction_category.toLowerCase();
    let stage_1_emp_remark = frm.doc.stage_1_emp_remark;
    let stage_2_emp_remark = frm.doc.stage_2_emp_remark;
    if (
      frm.doc.status == "Pending" &&
      frm.doc.stage_1_emp_status == "Pending"
    ) {
      frm.set_intro(
        '<span style="font-size: 15px; display: flex; align-items: center;">' +
          '<span style="width: 20px; height: 20px; background-color: #66AB63; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 5px;">' +
          '<span style="color: white;">&#10003;</span>' + // Checkmark symbol
          "</span>" +
          " Your " +
          transaction_category.toLowerCase() +
          " request has been submitted successfully." +
          "</span>",
        "green",
      );
      // frm.disable_save();
    } else if (frm.doc.stage_1_emp_status == "Rejected") {
      frm.set_intro(
        '<span style="font-size: 15px; display: flex; align-items: center;">' +
          '<span style="width: 20px; height: 20px; background-color: #FFB0B0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 5px;">' +
          "</span>" +
          "Your " +
          transaction_category.toLowerCase() +
          " request Rejected By COM." +
          "</span>" +
          "<br><b>Reason :- <b>" +
          stage_1_emp_remark,
        "red",
      );
    } else if (frm.doc.stage_2_emp_status == "Rejected") {
      frm.set_intro(
        '<span style="font-size: 15px; display: flex; align-items: center;">' +
          '<span style="width: 20px; height: 20px; background-color: #FFB0B0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 5px;">' +
          "</span>" +
          "Your " +
          transaction_category.toLowerCase() +
          " request Rejected By Head Office." +
          "</span>" +
          "<br><b>Reason :- <b>" +
          stage_2_emp_remark,
        "red",
      );
    }
  },

  ho_show_intro: function (frm) {
    let transaction_category = frm.doc.transaction_category.toLowerCase();
    let stage_1_emp_remark = frm.doc.stage_1_emp_remark;
    let stage_2_emp_remark = frm.doc.stage_2_emp_remark;

    if (frm.doc.stage_2_emp_status == "Pending") {
      frm.set_intro(
        '<span style="font-size: 15px; display: flex; align-items: center;">' +
          '<span style="width: 20px; height: 20px; background-color: #FFB0B0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 5px;">' +
          "</span>" +
          "Please verify this " +
          transaction_category.toLowerCase() +
          " request & select either '<b>Approve</b>' or '<b>Reject</b>'." +
          "</span>",
        "orange",
      );

      frm.disable_save();
    } else if (frm.doc.stage_2_emp_status == "Approved") {
      frm.set_intro(
        '<span style="font-size: 15px; display: flex; align-items: center;">' +
          '<span style="width: 20px; height: 20px; background-color: #66AB63; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 5px;">' +
          '<span style="color: white;">&#10003;</span>' + // Checkmark symbol
          "</span>" +
          " You have Approved this " +
          transaction_category.toLowerCase() +
          " request successfully." +
          "</span>",
        "green",
      );
    } else if (frm.doc.stage_2_emp_status == "Rejected") {
      frm.set_intro(
        '<span style="font-size: 15px; display: flex; align-items: center;">' +
          '<span style="width: 20px; height: 20px; background-color: #FFB0B0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 5px;">' +
          "</span>" +
          "You have Rejected this " +
          transaction_category.toLowerCase() +
          " request." +
          "</span>" +
          "<br><b>Reason :- <b>" +
          stage_2_emp_remark,
        "red",
      );
    }
  },
  ho_buttons: function (frm) {
    frm.add_custom_button(__("Approve"), function () {
      if (
        frm.doc.stage_2_emp_status === "Pending" ||
        frm.doc.stage_2_emp_status === "Rejected"
      ) {
        // Create the fields array and add conditionally based on requested_movement_changes
        let fields = [
          {
            label: __("Please Give Remarks for Approval"),
            fieldname: "stage_2_emp_remark", // Remarks field
            fieldtype: "Small Text",
            reqd: 1, // Make the remarks field mandatory
          },
        ];

        // Only show movement change fields if requested_movement_changes has a value
        if (frm.doc.requested_movement_changes) {
          fields.unshift(
            {
              label: __("Requested Movement Changes"),
              fieldname: "requested_movement_changes", // Show requested changes
              fieldtype: "Data",
              default: frm.doc.requested_movement_changes, // Set the value from the form
              read_only: 1, // Make it read-only
            },
            {
              label: __("Approved Movement Charges"),
              fieldname: "approved_movement_charges", // Input for approved charges
              fieldtype: "Data",
              reqd: 1, // Make it mandatory
            },
          );
        }

        // Create a dialog for approval remarks and requested/approved movement charges
        var approvalDialog = new frappe.ui.Dialog({
          title: __("Approval Remarks and Movement Charges"),
          fields: fields,
          primary_action_label: __("Approve"),
          primary_action: function () {
            // Check if remarks are provided
            const remarks =
              approvalDialog.fields_dict.stage_2_emp_remark.get_value();
            if (!remarks) {
              frappe.msgprint(__("Please provide remarks for approval."));
              return;
            }

            // If movement charges field is shown, check for approved charges
            const approvedMovementCharges = frm.doc.requested_movement_changes
              ? approvalDialog.fields_dict.approved_movement_charges.get_value()
              : null;

            if (
              frm.doc.requested_movement_changes &&
              !approvedMovementCharges
            ) {
              frappe.msgprint(__("Please provide approved movement charges."));
              return;
            }

            // Set the approval status, remarks, and approved movement charges (if applicable)
            frm.set_value("stage_2_emp_status", "Approved");
            frm.set_value("status", "Approved");
            frm.set_value("stage_2_emp_remark", remarks);

            if (approvedMovementCharges) {
              frm.set_value(
                "approved_movement_charges",
                approvedMovementCharges,
              ); // Save input to doc
            }

            approvalDialog.hide();

            // Show success alert
            frappe.show_alert(
              {
                message: __("Form is Successfully Approved"),
                indicator: "green",
              },
              8,
            );
            // preserve_child_tables(frm);

            // Save the form
            frm.save();
          },
          secondary_action_label: __("Cancel"),
          secondary_action: function () {
            approvalDialog.hide();
          },
        });

        // Show the approval dialog
        approvalDialog.show();
      } else {
        frappe.msgprint("Already Approved", "Message", "red");
      }
    });

    frm.add_custom_button(__("Reject"), function () {
      var d = new frappe.ui.Dialog({
        title: __("Rejection Reason"),
        fields: [
          {
            label: __("Please Give Reason of Rejection for this Request"),
            fieldname: "stage_2_emp_remark", // Correct field name
            fieldtype: "Small Text",
            reqd: 1, // Set the rejection reason field as mandatory
          },
        ],
        primary_action_label: __("Reject"),
        primary_action: function () {
          // Check if the rejection reason is provided
          if (!d.fields_dict.stage_2_emp_remark.get_value()) {
            frappe.msgprint(__("Please provide a rejection reason."));
            return;
          }

          frm.set_value("stage_2_emp_status", "Rejected");
          frm.set_value(
            "stage_2_emp_remark",
            d.fields_dict.stage_2_emp_remark.get_value(), // Corrected reference
          );
          d.hide();
          frm.set_value("status", "Rejected");
          // preserve_child_tables(frm);
          cur_frm.save();
        },
        secondary_action_label: __("Cancel"),
        secondary_action: function () {
          d.hide();
        },
      });

      d.show();
    });

    frm.change_custom_button_type("Approve", null, "success");
    frm.change_custom_button_type("Reject", null, "danger");
  },
  com_buttons: function (frm) {
    frm.add_custom_button(__("Approve"), function () {
      if (
        frm.doc.stage_1_emp_status === "Pending" ||
        frm.doc.stage_1_emp_status === "Rejected" ||
        frm.doc.stage_1_emp_status === "Approved"
      ) {
        // Create a dialog for approval remarks
        var approvalDialog = new frappe.ui.Dialog({
          title: __("Approval Remarks"),
          fields: [
            {
              label: __("Please Give Remarks for Approval"),
              fieldname: "stage_1_emp_remark", // Use the same field name as in Reject
              fieldtype: "Small Text",
              reqd: 1, // Set the remarks field as mandatory
            },
          ],
          primary_action_label: __("Approve"),
          primary_action: function () {
            // Check if the remarks are provided
            if (!approvalDialog.fields_dict.stage_1_emp_remark.get_value()) {
              frappe.msgprint(__("Please provide remarks for approval."));
              return;
            }

            // Set the approval status and remarks
            frm.set_value("stage_1_emp_status", "Approved");
            frm.set_value("stage_2_emp_status", "Pending");
            frm.set_value(
              "stage_1_emp_remark",
              approvalDialog.fields_dict.stage_1_emp_remark.get_value(),
            );
            approvalDialog.hide();

            // Show success alert
            frappe.show_alert(
              {
                message: __("Form is Successfully Approved"),
                indicator: "green",
              },
              8,
            );

            // Save the form
            // preserve_child_tables(frm);
            frm.save();
          },
          secondary_action_label: __("Cancel"),
          secondary_action: function () {
            approvalDialog.hide();
          },
        });

        // Show the approval remarks dialog
        approvalDialog.show();
      } else {
        frappe.msgprint("Already Approved", "Message", "red");
      }
    });

    frm.add_custom_button(__("Reject"), function () {
      var d = new frappe.ui.Dialog({
        title: __("Rejection Reason"),
        fields: [
          {
            label: __("Please Give Reason of Rejection for this Request"),
            fieldname: "stage_1_emp_remark", // Same field name as in Approval
            fieldtype: "Small Text",
            reqd: 1, // Set the rejection reason field as mandatory
          },
        ],
        primary_action_label: __("Reject"),
        primary_action: function () {
          // Check if the rejection reason is provided
          if (!d.fields_dict.stage_1_emp_remark.get_value()) {
            frappe.msgprint(__("Please provide a rejection reason."));
            return;
          }

          frm.set_value("stage_1_emp_status", "Rejected");
          frm.set_value(
            "stage_1_emp_remark",
            d.fields_dict.stage_1_emp_remark.get_value(),
          );
          d.hide();
          frm.set_value("status", "Rejected");
          // preserve_child_tables(frm);
          cur_frm.save();
        },
        secondary_action_label: __("Cancel"),
        secondary_action: function () {
          d.hide();
        },
      });

      d.show();
    });

    frm.change_custom_button_type("Approve", null, "success");
    frm.change_custom_button_type("Reject", null, "danger");
  },

  com_show_intro: function (frm) {
    let transaction_category = frm.doc.transaction_category.toLowerCase();
    let stage_1_emp_remark = frm.doc.stage_1_emp_remark;
    if (frm.doc.stage_1_emp_status == "Pending") {
      frm.set_intro(
        "Please verify this request & select either '<b>Approve</b>' or '<b>Reject</b>'.",
        "red",
      );
    } else if (frm.doc.stage_1_emp_status == "Approved") {
      frm.set_intro(
        '<span style="font-size: 15px; display: flex; align-items: center;">' +
          '<span style="width: 20px; height: 20px; background-color: #66AB63; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 5px;">' +
          '<span style="color: white;">&#10003;</span>' + // Checkmark symbol
          "</span>" +
          " You have Approved this " +
          transaction_category.toLowerCase() +
          " request successfully." +
          "</span>",
        "green",
      );
    } else if (frm.doc.stage_1_emp_status == "Rejected") {
      console.log("reject coms");

      frm.set_intro(
        '<span style="font-size: 15px; display: flex; align-items: center;">' +
          '<span style="width: 20px; height: 20px; background-color: #FFB0B0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 5px;">' +
          "</span>" +
          "You have Rejected this " +
          transaction_category.toLowerCase() +
          " request." +
          "</span>" +
          "<br><b>Reason :- <b>" +
          stage_1_emp_remark,
        "red",
      );
    }
  },
  creator_submit_btn: function (frm) {
    let transaction_category = frm.doc.transaction_category;

    frm.add_custom_button(__("Submit"), function () {
      // ✅ FIRST: frontend mandatory check
      if (
        !frm.doc.transaction_category ||
        !frm.doc.date_of_transaction ||
        !frm.doc.custodian_1 ||
        !frm.doc.custodian_2
      ) {
        frappe.msgprint("Please fill all mandatory fields.");
        return;
      }

      frappe.confirm("Are you sure you want to submit?", function () {
        // 🔹 ONLY save first
        frm
          .save()
          .then(() => {
            // 🔹 AFTER successful save → fetch COM approver
            frappe.db
              .get_value("CMS User", { com_approver: 1 }, "user")
              .then((r) => {
                if (!r.message) {
                  frappe.msgprint("COM Approver not configured");
                  return;
                }

                frappe.db
                  .get_value("Employee", { user_id: r.message.user }, "name")
                  .then((emp) => {
                    if (!emp.message) {
                      frappe.msgprint("Employee not found for COM Approver");
                      return;
                    }

                    // ✅ NOW update workflow fields
                    frm.set_value("stage_1_emp_user", emp.message.name);
                    frm.set_value("stage_1_emp_status", "Pending");
                    frm.set_value("status", "Pending");

                    frm.save().then(() => {
                      frappe.show_alert(
                        {
                          message: "Form submitted successfully",
                          indicator: "green",
                        },
                        8,
                      );
                    });
                  });
              });
          })
          .catch(() => {
            frappe.msgprint("Please fix validation errors.");
          });
      });
    });

    frm.change_custom_button_type("Submit", null, "success");
  },
  show_approval_tracker: function (frm) {
    let com = frm.doc.stage_1_emp_user;
    let ho = frm.doc.stage_2_emp_user;
    console.log("com-", com);
    console.log("ho-", ho);
    let fullName = "";
    let hofullName = "";

    let comID = com ? com.match(/^\d+/)[0] : null;
    let hoID = ho ? ho.match(/^\d+/)[0] : null;

    console.log("com extracted number -", comID);
    console.log("ho extracted number -", hoID);

    // Fetch COM Approval User Name
    if (com) {
      frm.call({
        method: "fetch_employee", // Adjust the path to your Python method
        args: {
          employee_id: comID,
        },
        callback: function (response) {
          if (response.message) {
            fullName = response.message[0].employee_name;
            console.log("COM Full Name:", fullName);
            // Update the HTML dynamically with the full name
            //document.getElementById("fullName").innerText = fullName;
            frm.fields_dict.approval_tracker.$wrapper
              .find("#step-2 b")
              .text(fullName);
          }
        },
      });
      // frappe.db
      //   .get_value("Employee", { user_id: com }, ["first_name", "last_name"])
      //   .then((response) => {
      //     if (response.message) {
      //       console.log("com response:", response.message);
      //       let { first_name, last_name } = response.message;
      //       fullName = `${first_name} ${last_name}`;
      //       frm.fields_dict.approval_tracker.$wrapper
      //         .find("#step-2 b")
      //         .text(fullName);
      //     }
      //   });
    }

    // Fetch HO Approval User Name
    if (ho) {
      frm.call({
        method: "fetch_employee", // Adjust the path to your Python method
        args: {
          employee_id: hoID,
        },
        callback: function (response) {
          if (response.message) {
            hofullName = response.message[0].employee_name;
            console.log("HO Full Name:", hofullName);
            // Update the HTML dynamically with the full name
            //document.getElementById("fullName").innerText = fullName;
            frm.fields_dict.approval_tracker.$wrapper
              .find("#step-3 b")
              .text(hofullName);
          }
        },
      });
      // frappe.db
      //   .get_value("Employee", { user_id: ho }, ["first_name", "last_name"])
      //   .then((response) => {
      //     if (response.message) {
      //       let { first_name, last_name } = response.message;
      //       hofullName = `${first_name} ${last_name}`;
      //       frm.fields_dict.approval_tracker.$wrapper
      //         .find("#step-3 b")
      //         .text(hofullName);
      //     }
      //   });
    }
    // Helper function to handle blank/null statuses
    const getStatus = (status, fallback) => {
      return status && status !== "" ? status : fallback;
    };

    // Initialize step_1_status based on stage_1_emp_status
    let step_1_status;
    if (!frm.doc.stage_1_emp_status) {
      step_1_status = "Draft"; // Set to "Draft" if stage_1_emp_status is empty
    } else {
      step_1_status = "Approved"; // Set to "Approved" if stage_1_emp_status is not empty
    }

    const step_2_status = getStatus(frm.doc.stage_1_emp_status, "Pending");
    const step_3_status = getStatus(frm.doc.stage_2_emp_status, "Pending");
    const step_4_status =
      frm.doc.status === "Rejected"
        ? "Disabled"
        : getStatus(frm.doc.status, "Pending");

    console.log("Step 1:", step_1_status);
    console.log("Step 2:", step_2_status);
    console.log("Step 3:", step_3_status);
    console.log("Step 4:", step_4_status);

    // Generate HTML for the approval tracker
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Progress Tracker</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .progress-container {
              display: flex;
              justify-content: space-between;
              width: 100%;
              margin: 0 auto;
              position: relative;
              padding-top: 10px;
            }
            .progress-step {
              text-align: center;
              position: relative;
              z-index: 2;
            }
            .step-circle {
              width: 25px;
              height: 25px;
              background-color: #e0e0e0;
              border-radius: 50%;
              margin: 0 auto;
              position: relative;
            }
            .progress-label {
              margin-top: 10px;
              font-size: 14px;
              color: #333; /* Default color */
            }
            .progress-step.completed .progress-label {
              color: #1196ab; /* Color for completed steps */
              font-weight: bold;
            }
            .progress-step.rejected .progress-label {
              color: red; /* Color for rejected steps */
            }
            .progress-step.disabled .progress-label {
              color: #999; /* Color for disabled steps */
            }
            .progress-bar-container {
              position: absolute;
              top: 20px;
              left: 50px;
              right: 50px;
              height: 8px;
              background-color: #e0e0e0;
            }
            .progress-bar {
              position: absolute;
              top: 0;
              left: 0;
              height: 100%;
              background-color: #1196ab;
              transition: width 0.3s ease;
            }
            .progress-step.completed .step-circle {
              background-color: #1196ab;
            }
            .progress-step.completed .step-circle::after {
              content: "✔"; /* Completed checkmark */
              color: white;
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              text-align: center;
              line-height: 25px;
            }
            .progress-step.rejected .step-circle {
             
            }
            .progress-step.rejected .step-circle::after {
              content: "❌"; /* Rejected cross mark */
              color: white;
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              text-align: center;
              line-height: 25px;
            }
            .progress-step.disabled .step-circle {
              background-color: #e0e0e0; /* Greyed out for disabled steps */
            }
          </style>
      </head>
      <body>
          <div class="progress-container">
              <div class="progress-bar-container">
                  <div class="progress-bar" id="progress-bar"></div>
              </div>
              <div class="progress-step" id="step-1">
                  <div class="step-circle"></div>
                  <div class="progress-label">Form Submission</div>
              </div>
              <div class="progress-step" id="step-2">
                  <div class="step-circle"></div>
                  <div class="progress-label">COM Approval</div>
                   <b id="fullName">${fullName}</b>
              </div>
              <div class="progress-step" id="step-3">
                  <div class="step-circle"></div>
                  <div class="progress-label">CMS/HO Approval</div>
                   <b id="hofullName">${hofullName}</b>
              </div>
              <div class="progress-step" id="step-4">
                  <div class="step-circle"></div>
                  <div class="progress-label">Request Approved</div>
              </div>
          </div>
      </body>
      </html>
    `;

    // Set the HTML in the form field
    frm.set_df_property("approval_tracker", "options", html);

    // Update the tracker based on the statuses
    const script = `
    function updateProgressTracker() {
      const statuses = {
        "step-1": "${step_1_status}",
        "step-2": "${step_2_status}",
        "step-3": "${step_3_status}",
        "step-4": "${step_4_status}",
      };
      const steps = document.querySelectorAll(".progress-step");
      const progressBar = document.getElementById("progress-bar");
  
      let width = 0;
      let lastRejectedIndex = -1;  // Track the index of the last rejected step
  
      // Find the last rejected step
      Object.keys(statuses).forEach((stepId, index) => {
        if (statuses[stepId] === "Rejected") {
          lastRejectedIndex = index;
        }
      });
  
      // Update each step based on the status
      steps.forEach((step, index) => {
        const stepId = step.id;
        const status = statuses[stepId];
  
        if (lastRejectedIndex >= 0 && index > lastRejectedIndex) {
          // Disable all steps after the last rejected step
          step.classList.add("disabled");
          step.classList.remove("completed", "rejected");
        } else if (index === lastRejectedIndex) {
          // Show the rejected mark on the last rejected step
          step.classList.add("rejected");
          step.classList.remove("completed", "disabled");
        } else if (index < lastRejectedIndex || status === "Approved") {
          // Mark steps as completed if approved or before the rejected step
          step.classList.add("completed");
          step.classList.remove("rejected", "disabled");
          width += 25;  // Update progress bar
        }
      });
  
      // Set the progress bar width based on the completion
      progressBar.style.width = \`\${width}%\`;
    }
  
    // Immediately call to set the initial progress
    updateProgressTracker();
  `;

    // Add the script to the form field
    frm
      .get_field("approval_tracker")
      .$wrapper.append(`<script>${script}<\/script>`);
  },

  role_check: function (frm) {
    if (frappe.session.user === "Administrator") return;

    // 🚫 DO NOT restrict approvers
    if (["COM-Approver", "HO-Approver"].includes(frm._cms_role)) {
      return;
    }

    frappe.db
      .get_value("Employee", { user_id: frappe.session.user }, "designation")
      .then((r) => {
        if (!r.message) return;

        const designation = (r.message.designation || "").toUpperCase().trim();
        const allowedDesignations = [
          "BRANCH MANAGER",
          "BRANCH OPERATION MANAGER",
          "BRANCH OFFICER",
          "ASST. BRANCH MANAGER",
          "CUSTOMER SERVICE OFFICER",
          "CUSTOMER SERVICE MANAGER",
        ];

        if (!allowedDesignations.some((d) => designation.includes(d))) {
          frm.disable_save();
        }
      });
  },
  select_branch: function (frm) {
    if (!frm.doc.select_branch) {
      frm.set_df_property("requested_branch", "hidden", 1); // Hide requested_branch when select_branch is empty
    } else if (frm.doc.select_branch == "Gondia HO") {
      set_field_options("transaction_type", ["ACCOUNT TRANSFER"]);
      frm.set_value("requested_branch", "Gondia HO"); // Set the value of requested_branch to "Gondia HO"
      frm.set_df_property("requested_branch", "readonly", 1); // Make requested_branch readonly
      frm.set_df_property("requested_branch", "hidden", 0); // Ensure requested_branch is visible
    } else if (frm.doc.select_branch == "Other Branch") {
      frm.set_value("requested_branch", ""); // Clear the value of requested_branch
      frm.set_df_property("requested_branch", "readonly", 0); // Make requested_branch editable
      frm.set_df_property("requested_branch", "hidden", 0); // Ensure requested_branch is visible
      set_field_options("transaction_type", ["CASH", "ACCOUNT TRANSFER"]);
    }
  },
  transaction_type: function (frm) {
    let type = frm.doc.transaction_type;
    if (type == "CASH") {
      frm.set_df_property("bank_name", "readonly", 1); // Make requested_branch readonly
      frm.set_df_property("bank_name", "hidden", 1); // Ensure requested_branch is visible

      frm.set_df_property("ifsc_code", "readonly", 1); // Make requested_branch readonly
      frm.set_df_property("ifsc_code", "hidden", 1); // Ensure requested_branch is visible
      frm.set_df_property("account_number", "readonly", 1); // Make requested_branch readonly
      frm.set_df_property("account_number", "hidden", 1); // Ensure requested_branch is visible
      frm.set_df_property("cheque_number", "readonly", 1); // Make requested_branch readonly
      frm.set_df_property("cheque_number", "hidden", 1); // Ensure requested_branch is visible
    } else {
      frm.set_df_property("bank_name", "readonly", 0); // Make requested_branch readonly
      frm.set_df_property("bank_name", "hidden", 0); // Ensure requested_branch is visible
      frm.set_df_property("ifsc_code", "readonly", 0); // Make requested_branch readonly
      frm.set_df_property("ifsc_code", "hidden", 0); // Ensure requested_branch is visible
      frm.set_df_property("account_number", "readonly", 0); // Make requested_branch readonly
      frm.set_df_property("account_number", "hidden", 0); // Ensure requested_branch is visible
      frm.set_df_property("cheque_number", "readonly", 0); // Make requested_branch readonly
      frm.set_df_property("cheque_number", "hidden", 0); // Ensure requested_branch is visible
    }
  },

  show_employee: function (frm) {
    let user;
    let eid;
    if (frm.is_new()) {
      user = frappe.session.user;
      eid = user.match(/\d+/)[0];
      frm.set_value("employee", eid);
    } else if (!frm.is_new()) {
      eid = frm.doc.employee;
    }

    // Fetching Employee Data
    frm.call({
      method: "fetch_employee",
      args: { employee_id: eid },
      callback: function (r) {
        // Bail out on RPC error
        if (r.exc) {
          console.error("fetch_employee error:", r.exc);
          return;
        }

        if (r.message && r.message[0]) {
          const employeeData = r.message[0]; // Accessing the first element of the array
          // set sol_id from the fetched data
          frm.doc.sol_id = employeeData.sol_id;

          console.log("Employee Data:", employeeData);

          // Safeguard against potential HTML injection
          const escapeHtml = (unsafe) => {
            return (unsafe || "")
              .toString()
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
          };

          // Directly set the response data in HTML with inline CSS, using escaped values
          let html = `
        <style>
        .myemployee-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr); /* Creates 3 equal columns */
          gap: 10px; /* Adds space between items */
        }
        .myemployee-grid p {
          border-radius: 5px;
          padding: 7px;
          margin: 5px;
          background: #f4f5f6;
        }
        .mylabel{
          margin:8px;
          font-size: var(--text-sm);
        }
        </style>
        <div class="employee-details">
          <div class="myemployee-grid">
          <div>
            <span class="mylabel">Employee Name</span>
            <p id="employee_name">${escapeHtml(employeeData.employee_name)}</p>
            <span class="mylabel">Employee ID</span>
            <p id="employee_id">${escapeHtml(eid)}</p>
            <span class="mylabel">Designation</span>
            <p id="employee_designation">${escapeHtml(employeeData.designation)}</p>
          </div>
          <div>
          <span class="mylabel">Phone</span>
            <p id="employee_phone">${escapeHtml(employeeData.cell_number)}</p>
            <span class="mylabel">Region</span>
            <p id="employee_region">${escapeHtml(employeeData.custom_region)}</p>
            <span class="mylabel">Division</span>
            <p id="employee_division">${escapeHtml(employeeData.custom_division)}</p>
          </div>
          <div>
          <span class="mylabel">District</span>
            <p id="employee_district">${escapeHtml(employeeData.custom_district)}</p>
            <span class="mylabel">Branch</span>
            <p id="employee_branch">${escapeHtml(employeeData.branch)}</p>
            <span class="mylabel">Department</span>
            <p id="employee_department">${escapeHtml(employeeData.department)}</p>
          </div>
          </div>
        </div>
      `;

          // Set the above `html` as Summary HTML
          frm.set_df_property("employee_html", "options", html);
        }
      },
    });
  },

  set_branch: async function (frm) {
    const user = frappe.session.user;
    try {
      const r = await frappe.db.get_value("Employee", { user_id: user }, [
        "branch",
        "sol_id",
      ]);
      if (r.message) {
        frm.set_value("branch", r.message.branch);
      }
    } catch {
      console.log("Error fetching employee branch");
    }
  },

  set_request_date_time: function (frm) {
    frm.call({
      method: "get_server_datetime",
      callback: function (r) {
        if (!r.exc && r.message) {
          frm.set_value("date_of_request", r.message);
          frm.refresh_field("date_of_request");
        } else {
          // Handle the case where there is an error or no response
          console.error("SERVER INTERNET ERROR ", r.exc || "No response");
        }
      },
    });
  },
  // onload: function (frm) {
  //   frm.trigger("custodian_1_filter");
  //   frm.trigger("custodian_2_filter");
  // },
  custodian_1_filter: function (frm) {
    frm.set_query("custodian_1", function () {
      return {
        query:
          "cash_management_system.cash_management_system.doctype.cms.cms.get_employees_by_branch",
        filters: { branch: frm.doc.branch },
      };
    });
  },
  custodian_2_filter: function (frm) {
    frm.set_query("custodian_2", function () {
      return {
        query:
          "cash_management_system.cash_management_system.doctype.cms.cms.get_employees_by_branch",
        filters: { branch: frm.doc.branch },
      };
    });
  },
  custodian_1: function (frm) {
    if (frm.doc.custodian_1) {
      frm.call({
        method: "fetch_employee",
        args: {
          employee_id: frm.doc.custodian_1,
        },
        callback: function (r) {
          if (!r.exc) {
            const employeeData = r.message[0]; // Accessing the first element of the array
            console.log("Employee Data:", employeeData);

            // Safeguard against potential HTML injection
            const escapeHtml = (unsafe) => {
              return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
            };

            // Directly set the response data in HTML with inline CSS
            let html = `
                  <style>
                    .myemployee-grid {
                      display: grid;
                      grid-template-columns: repeat(3, 1fr); /* Creates 3 equal columns */
                      gap: 10px; /* Adds space between items */
                    }
                    .myemployee-grid p {
                      border-radius: 5px;
                      padding: 7px;
                      margin: 5px;
                      background: #f4f5f6;
                    }
                    .mylabel {
                      margin: 8px;
                      font-size: var(--text-sm);
                    }
                  </style>
                  <div class="employee-details">
                      <div class="myemployee-grid">
                        <div>
                          <span class="mylabel">Custodian 1 Name</span>
                          <p id="employee_name">${escapeHtml(
                            employeeData.employee_name || "",
                          )}</p>
                          <span class="mylabel">Employee ID</span>
                          <p id="employee_id">${escapeHtml(
                            frm.doc.custodian_1 || "",
                          )}</p>
                          <span class="mylabel">Designation</span>
                          <p id="employee_designation">${escapeHtml(
                            employeeData.designation || "",
                          )}</p><hr>
                        </div>
                        <div>
                          <span class="mylabel">Phone</span>
                          <p id="employee_phone">${escapeHtml(
                            employeeData.cell_number || "",
                          )}</p>
                          <span class="mylabel">Region</span>
                          <p id="employee_region">${escapeHtml(
                            employeeData.custom_region || "",
                          )}</p>
                          <span class="mylabel">Division</span>
                          <p id="employee_division">${escapeHtml(
                            employeeData.custom_division || "",
                          )}</p><hr>
                        </div>
                        <div>
                          <span class="mylabel">District</span>
                          <p id="employee_district">${escapeHtml(
                            employeeData.custom_district || "",
                          )}</p>
                          <span class="mylabel">Branch</span>
                          <p id="employee_branch">${escapeHtml(
                            employeeData.branch || "",
                          )}</p>
                          <span class="mylabel">Department</span>
                          <p id="employee_department">${escapeHtml(
                            employeeData.department || "",
                          )}</p><hr>
                        </div>
                      </div>
                  </div>
              `;

            // Set the above `html` as Summary HTML
            frm.set_df_property("custodian_1_html", "options", html);
          }
        },
      });
    }
  },
  custodian_2: function (frm) {
    if (frm.doc.custodian_2) {
      frm.call({
        method: "fetch_employee",
        args: {
          employee_id: frm.doc.custodian_2,
        },
        callback: function (r) {
          if (!r.exc) {
            const employeeData = r.message[0]; // Accessing the first element of the array
            console.log("Employee Data:", employeeData);

            // Safeguard against potential HTML injection
            const escapeHtml = (unsafe) => {
              return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
            };

            // Directly set the response data in HTML with inline CSS
            let html = `
                  <style>
                    .myemployee-grid {
                      display: grid;
                      grid-template-columns: repeat(3, 1fr); /* Creates 3 equal columns */
                      gap: 10px; /* Adds space between items */
                    }
                    .myemployee-grid p {
                      border-radius: 5px;
                      padding: 7px;
                      margin: 5px;
                      background: #f4f5f6;
                    }
                    .mylabel {
                      margin: 8px;
                      font-size: var(--text-sm);
                    }
                  </style>
                  <div class="employee-details">
                      <div class="myemployee-grid">
                        <div>
                          <span class="mylabel">Custodian 2 Name</span>
                          <p id="employee_name">${escapeHtml(
                            employeeData.employee_name || "",
                          )}</p>
                          <span class="mylabel">Employee ID</span>
                          <p id="employee_id">${escapeHtml(
                            frm.doc.custodian_2 || "",
                          )}</p>
                          <span class="mylabel">Designation</span>
                          <p id="employee_designation">${escapeHtml(
                            employeeData.designation || "",
                          )}</p><hr>
                        </div>
                        <div>
                          <span class="mylabel">Phone</span>
                          <p id="employee_phone">${escapeHtml(
                            employeeData.cell_number || "",
                          )}</p>
                          <span class="mylabel">Region</span>
                          <p id="employee_region">${escapeHtml(
                            employeeData.custom_region || "",
                          )}</p>
                          <span class="mylabel">Division</span>
                          <p id="employee_division">${escapeHtml(
                            employeeData.custom_division || "",
                          )}</p><hr>
                        </div>
                        <div>
                          <span class="mylabel">District</span>
                          <p id="employee_district">${escapeHtml(
                            employeeData.custom_district || "",
                          )}</p>
                          <span class="mylabel">Branch</span>
                          <p id="employee_branch">${escapeHtml(
                            employeeData.branch || "",
                          )}</p>
                          <span class="mylabel">Department</span>
                          <p id="employee_department">${escapeHtml(
                            employeeData.department || "",
                          )}</p><hr>
                        </div>
                      </div>
                  </div>
              `;

            // Set the above `html` as Summary HTML
            frm.set_df_property("custodian_2_html", "options", html);
          }
        },
      });
    }
  },

  section_colors(frm) {
    // Set background color, border color, border radius, margin, and 3D shadow for "transaction_details_section"
    frm.fields_dict["transaction_details_section"].wrapper.css({
      "background-color": "#ffffff", // White background
      "border-color": "#eaeaea", // Border color
      "border-width": "2px", // Set the border width
      "border-style": "solid", // Set the border style
      "border-radius": "8px", // Set the border radius for curved corners
      "margin-bottom": "5px", // Add bottom margin for spacing
    });

    // Set background color and border color for "ac_information_section"
    frm.fields_dict["section_break_7tryz"].wrapper.css({
      "background-color": "#ffffff", // White background
      "border-color": "#eaeaea", // Border color
      "border-width": "2px", // Set the border width
      "border-style": "solid", // Set the border style
      "border-radius": "8px", // Set the border radius for curved corners
      "margin-bottom": "5px", // Add bottom margin for spacing
    });

    // Set background color and border color for "custodian_details_section"
    frm.fields_dict["custodian_details_section"].wrapper.css({
      "background-color": "#ffffff", // White background
      "border-color": "#eaeaea", // Border color
      "border-width": "2px", // Set the border width
      "border-style": "solid", // Set the border style
      "border-radius": "8px", // Set the border radius for curved corners
      "margin-bottom": "5px", // Add bottom margin for spacing
    });

    // Set background color and border color for "employee_details_section"
    frm.fields_dict["employee_details_section"].wrapper.css({
      "background-color": "#ffffff", // White background
      "border-color": "#eaeaea", // Border color
      "border-width": "2px", // Set the border width
      "border-style": "solid", // Set the border style
      "border-radius": "10px", // Set the border radius for curved corners
      "margin-bottom": "5px", // Add bottom margin for spacing
    });

    // Set background color and border color for "employee_details_section"
    frm.fields_dict["level_1_section"].wrapper.css({
      "background-color": "#ffffff", // White background
      "border-color": "#eaeaea", // Border color
      "border-width": "2px", // Set the border width
      "border-style": "solid", // Set the border style
      "border-radius": "10px", // Set the border radius for curved corners
      "margin-bottom": "5px", // Add bottom margin for spacing
    });
    // Set background color and border color for "employee_details_section"
    frm.fields_dict["level_2_section"].wrapper.css({
      "background-color": "#ffffff", // White background
      "border-color": "#eaeaea", // Border color
      "border-width": "2px", // Set the border width
      "border-style": "solid", // Set the border style
      "border-radius": "10px", // Set the border radius for curved corners
      "margin-bottom": "5px", // Add bottom margin for spacing
    });

    // Set background color and border color for "employee_details_section"
    frm.fields_dict["status_section"].wrapper.css({
      "background-color": "#ffffff", // White background
      "border-color": "#eaeaea", // Border color
      "border-width": "2px", // Set the border width
      "border-style": "solid", // Set the border style
      "border-radius": "10px", // Set the border radius for curved corners
      "margin-bottom": "5px", // Add bottom margin for spacing
    });
    // Apply styles to the .std-form-layout > .form-layout > .form-page element
    $(".std-form-layout > .form-layout > .form-page").css({
      "border-radius": "0", // Remove border radius
      "box-shadow": "none", // Remove box shadow
      "background-color": "transparent", // Remove background color
    });
  },

  onload_post_render: function (frm) {
    frm.fields_dict["amount"].$input.on("keydown", function (event) {
      var key = event.key;
      var amountField = frm.fields_dict["amount"];

      // Allow only numeric keys (0-9), Delete, and Backspace
      if (
        !(
          (
            (key >= "0" && key <= "9") || // Allow numbers 0-9
            key === "ArrowRight" ||
            key === "ArrowLeft" ||
            key === "Delete" ||
            key === "Backspace"
          ) // Allow Backspace key
        )
      ) {
        event.preventDefault(); // Prevent any other keys from being entered
      }
    });

    frm.fields_dict["requested_movement_changes"].$input.on(
      "keydown",
      function (event) {
        var key = event.key;
        var amountField = frm.fields_dict["requested_movement_changes"];

        // Allow only numeric keys (0-9), Delete, and Backspace
        if (
          !(
            (
              (key >= "0" && key <= "9") || // Allow numbers 0-9
              key === "ArrowRight" ||
              key === "ArrowLeft" ||
              key === "Delete" ||
              key === "Backspace"
            ) // Allow Backspace key
          )
        ) {
          event.preventDefault(); // Prevent any other keys from being entered
        }
      },
    );
    frm.fields_dict["approved_movement_charges"].$input.on(
      "keydown",
      function (event) {
        var key = event.key;
        var amountField = frm.fields_dict["approved_movement_charges"];

        // Allow only numeric keys (0-9), Delete, and Backspace
        if (
          !(
            (
              (key >= "0" && key <= "9") || // Allow numbers 0-9
              key === "ArrowRight" ||
              key === "ArrowLeft" ||
              key === "Delete" ||
              key === "Backspace"
            ) // Allow Backspace key
          )
        ) {
          event.preventDefault(); // Prevent any other keys from being entered
        }
      },
    );

    frm.fields_dict["branch_distance_km"].$input.on(
      "keydown",
      function (event) {
        var key = event.key;
        var amountField = frm.fields_dict["branch_distance_km"];

        // Allow only numeric keys (0-9), Delete, and Backspace
        if (
          !(
            (
              (key >= "0" && key <= "9") || // Allow numbers 0-9
              key === "ArrowRight" ||
              key === "ArrowLeft" ||
              key === "Delete" ||
              key === "Backspace"
            ) // Allow Backspace key
          )
        ) {
          event.preventDefault(); // Prevent any other keys from being entered
        }
      },
    );
  },

  // validate: function (frm) {
  //   //let custodian_1 = frm.doc.custodian_1;
  // },
  transaction_category: function (frm) {
    toggle_cheque_number(frm);
  },
});

// frappe.ui.form.on("CMS", {
//   onload: function (frm) {
//     frm.set_query("bank_name", "cheque_details", function (doc, cdt, cdn) {
//       return {
//         filters: {
//           branch: frm.doc.branch,
//         },
//       };
//     });
//   },
// });
function preserve_child_tables(frm) {
  const child_tables = ["cheque_details"]; // add more if needed

  child_tables.forEach((field) => {
    if (frm.doc[field] && frm.doc[field].length) {
      frm.doc[field] = frm.doc[field].map((row) => ({ ...row }));
    }
  });
}
function toggle_cheque_number(frm) {
  const is_deposit = frm.doc.transaction_category === "DEPOSIT";

  // Access child table grid
  const grid = frm.get_field("cheque_details").grid;

  if (!grid) return;

  // Hide / show column
  grid.toggle_display("cheque_number", !is_deposit);

  // Optional but recommended: clear existing values
  if (is_deposit) {
    (frm.doc.cheque_details || []).forEach((row) => {
      row.cheque_number = null;
    });
    frm.refresh_field("cheque_details");
  }
}
function send_cit_ack(frm) {
  frappe.call({
    method:
      "cash_management_system.cash_management_system.doctype.cms.cms.send_cit_ack",
    args: {
      cms_name: frm.doc.name,
    },
    freeze: true,
    callback: function (r) {
      if (r.message?.status === "success") {
        frappe.show_alert(
          {
            message:
              __("CIT ACK sent to: ") + r.message.recipient_names.join(", "),
            indicator: "green",
          },
          8,
        );
        frm.reload_doc();
      }
    },
  });
}
function apply_page_access_control(frm) {
  const roles = frappe.user_roles || [];
  const designation = (frm._user_designation || "").toUpperCase().trim();

  const isBranchManager = roles.includes("Branch User");

  const allowedDesignations = [
    "ASST. BRANCH MANAGER",
    "BRANCH OFFICER",
    "BRANCH MANAGER",
    "BRANCH OPERATION MANAGER",
    "CUSTOMER SERVICE OFFICER",
    "CUSTOMER SERVICE MANAGER",
    "CLUSTER OPERATION MANAGER",
    "REGIONAL OPERATION MANAGER",
    "ASST. ZONAL MANAGER",
    "ZONAL MANAGER",
    "AGM",
  ];

  const isSpecialDesignation = allowedDesignations.some((d) =>
    designation.includes(d),
  );

  // ✅ Allowed users → DO NOTHING
  if (
    isBranchManager ||
    isSpecialDesignation ||
    frappe.session.user === "Administrator" ||
    frappe.session.user === "813@sahayog.com"
  ) {
    console.log("Access allowed");
    return;
  }

  // 🚫 Block everyone else
  frm.disable_save();
  frm.page.clear_primary_action();
  frm.page.clear_secondary_action();
  frm.page.main.empty();
  // you need Branch User roles
  frm.page.main.html(`
    <div style="padding:40px;text-align:center;color:#888;font-size:16px;">
     You are not authorized to view this page; please contact your administrator.
    </div>
  `);
}
