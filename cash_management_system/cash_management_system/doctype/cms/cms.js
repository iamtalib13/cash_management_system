frappe.ui.form.on("CMS", {
  onload: function (frm) {
    // If the form is new, refresh the window
    if (frm.is_new()) {
      window.location.reload(); // Refreshes the page
    }
  },
  validate: function (frm) {
    //frm.trigger("check_mandatory_child");
  },

  refresh: function (frm) {
    //frm.trigger("transaction_category");
    frm.trigger("transaction_type");

    frm.trigger("home_button");
    frm.trigger("role_validation");
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
  },
  home_button: function (frm) {
    frm.add_custom_button(__("Home"), function () {
      // Add your function logic here
      window.location.href = "/policies#cms";
    });
    frm.change_custom_button_type("Home", null, "#000000"); // Corrected to a valid hex color code
  },

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
    console.log(user);

    // Fetch the user's role asynchronously
    frappe.db
      .get_value("CMS User", user, "status")
      .then((result) => {
        let role = result.message.status;

        if (role == "Requester") {
          console.log("Requester");
          if (frm.doc.status == "Draft" && !frm.is_new()) {
            frm.trigger("creator_submit_btn");
          } else if (frm.doc.status !== "Draft") {
            frm.disable_save();
            frm.trigger("com_read_only");

            if (frm.doc.status == "Approved") {
              frm.trigger("requester_intro");
              frm.trigger("upload_attach");
            }
          }

          frm.trigger("creator_show_intro");
          frm.set_df_property("approved_movement_charges", "read_only", 1);
        } else if (role == "COM-Approver") {
          frm.trigger("com_read_only");
          console.log("COM-Approver");
          if (frm.doc.stage_1_emp_status == "Pending") {
            frm.trigger("com_buttons");
          }
          frm.trigger("com_show_intro");

          frm.set_df_property("approved_movement_charges", "read_only", 1);
        } else if (role == "HO-Approver") {
          frm.trigger("ho_show_intro");
          frm.trigger("ho_read_only");
          console.log("HO-Approver");

          if (frm.doc.stage_2_emp_status == "Pending") {
            frm.trigger("ho_buttons");
            frm.trigger("ho_intro");
          } else if (frm.doc.stage_2_emp_status == "Approved") {
            frm.trigger("ho_intro");
          }
        } else {
          // Check if the user has the role of "System Manager"

          if (frappe.user.has_role("System Manager")) {
            console.log("Admin");
          } else {
            // Disable the entire form
            frm.disable_form();

            // Disable save button
            frm.disable_save();
            console.log("cms user");
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching role:", err);
      });
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
      "green"
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
        "green"
      );
      frm.disable_save();
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
        "red"
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
        "red"
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
        "orange"
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
        "green"
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
        "red"
      );
    }
  },
  ho_buttons: function (frm) {
    frm.add_custom_button(__("Approve"), function () {
      if (frm.doc.stage_2_emp_status == "Pending") {
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
            }
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
                approvedMovementCharges
              ); // Save input to doc
            }

            approvalDialog.hide();

            // Show success alert
            frappe.show_alert(
              {
                message: __("Form is Successfully Approved"),
                indicator: "green",
              },
              8
            );

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
            d.fields_dict.stage_2_emp_remark.get_value() // Corrected reference
          );
          d.hide();
          frm.set_value("status", "Rejected");
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
      if (frm.doc.stage_1_emp_status == "Pending") {
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
              approvalDialog.fields_dict.stage_1_emp_remark.get_value()
            );
            approvalDialog.hide();

            // Show success alert
            frappe.show_alert(
              {
                message: __("Form is Successfully Approved"),
                indicator: "green",
              },
              8
            );

            // Save the form
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
            d.fields_dict.stage_1_emp_remark.get_value()
          );
          d.hide();
          frm.set_value("status", "Rejected");
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
        "red"
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
        "green"
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
        "red"
      );
    }
  },
  creator_submit_btn: function (frm) {
    let transaction_category = frm.doc.transaction_category;

    frm.add_custom_button(__("Submit"), function () {
      // Determine the confirmation message based on transaction_category value
      let confirmation_message = "";
      if (transaction_category === "DEPOSIT") {
        confirmation_message =
          "Are you sure you want to submit this DEPOSIT request?";
      } else if (transaction_category === "WITHDRAWAL") {
        confirmation_message =
          "Are you sure you want to submit this WITHDRAWAL request?";
      } else if (transaction_category === "CIT") {
        confirmation_message =
          "Are you sure you want to submit this CIT request?";
      } else {
        confirmation_message = "Are you sure you want to submit the form?";
      }

      // Show the confirmation dialog with the customized message
      frappe.confirm(
        confirmation_message,
        function () {
          // If user clicks "Yes", proceed with submission

          frm.set_value("status", "Pending");
          frm.set_value("stage_1_emp_status", "Pending");
          frappe.show_alert(
            {
              message: __("Form is Successfully submitted"),
              indicator: "green",
            },
            8
          );
          frm.save();
        },
        function () {
          // If user clicks "No", do nothing
        }
      );
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
    frappe.db
      .get_value("Employee", { user_id: frappe.session.user }, "designation")
      .then((r) => {
        if (r.message) {
          const designation = r.message.designation;
          const allowedDesignations = [
            "Branch Manager",
            "Branch Operation Manager",
            "BRANCH MANAGER",
            "BRANCH OPERATION MANAGER",
          ];
          console.log("Designation - ", designation);

          // Check if user has the "System Manager" role
          if (frappe.user.has_role("System Manager")) {
            console.log("Admin - No restriction applied.");
            return; // Exit the function if the user is an admin
          }

          // Disable form if not in allowed designations and not an admin
          if (!allowedDesignations.includes(designation)) {
            console.log("Not Admin");
            frm.disable_save();
          }
        } else {
          console.log("Employee record not found.");
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
      args: {
        employee_id: eid,
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
				.mylabel{
				  margin:8px;
				  font-size: var(--text-sm);
				}
			  </style>
			  <div class="employee-details">
				  <div class="myemployee-grid">
					<div>
					  <span class="mylabel">Employee Name</span>
					  <p id="employee_name">${employeeData.employee_name || ""}</p>
					  <span class="mylabel">Employee ID</span>
					  <p id="employee_id">${eid}</p>
					  <span class="mylabel">Designation</span>
					  <p id="employee_designation">${employeeData.designation || ""}</p>
					</div>
					<div>
					<span class="mylabel">Phone</span>
					  <p id="employee_phone"> ${employeeData.cell_number || ""}</p>
					  <span class="mylabel">Region</span>
					  <p id="employee_region"> ${employeeData.region || ""}</p>
					  <span class="mylabel">Division</span>
					  <p id="employee_division"> ${employeeData.division || ""}</p>
					</div>
					<div>
					<span class="mylabel">District</span>
					  <p id="employee_district"> ${employeeData.district || ""}</p>
					  <span class="mylabel">Branch</span>
					  <p id="employee_branch"> ${employeeData.branch || ""}</p>
					  <span class="mylabel">Department</span>
					  <p id="employee_department"> ${employeeData.department || ""}</p>
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
    const eid = user.match(/\d+/)[0];

    if (eid) {
      try {
        // Use async/await for cleaner asynchronous code
        const { message } = await frappe.db.get_value(
          "Employee",
          eid,
          "branch"
        );
        const branch = message ? message.branch : null;

        if (branch) {
          // Set the branch value on the form
          frm.set_value("branch", branch);
          // console.log(branch);
        } else {
          console.error("Branch not found for the employee.");
        }
      } catch (error) {
        console.error("Error retrieving branch:", error);
      }
    } else {
      console.error("Employee ID not found in the user session.");
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
  onload: function (frm) {
    frm.trigger("custodian_1_filter");
    frm.trigger("custodian_2_filter");
  },
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
                            employeeData.employee_name || ""
                          )}</p>
                          <span class="mylabel">Employee ID</span>
                          <p id="employee_id">${escapeHtml(
                            frm.doc.custodian_1 || ""
                          )}</p>
                          <span class="mylabel">Designation</span>
                          <p id="employee_designation">${escapeHtml(
                            employeeData.designation || ""
                          )}</p><hr>
                        </div>
                        <div>
                          <span class="mylabel">Phone</span>
                          <p id="employee_phone">${escapeHtml(
                            employeeData.cell_number || ""
                          )}</p>
                          <span class="mylabel">Region</span>
                          <p id="employee_region">${escapeHtml(
                            employeeData.region || ""
                          )}</p>
                          <span class="mylabel">Division</span>
                          <p id="employee_division">${escapeHtml(
                            employeeData.division || ""
                          )}</p><hr>
                        </div>
                        <div>
                          <span class="mylabel">District</span>
                          <p id="employee_district">${escapeHtml(
                            employeeData.district || ""
                          )}</p>
                          <span class="mylabel">Branch</span>
                          <p id="employee_branch">${escapeHtml(
                            employeeData.branch || ""
                          )}</p>
                          <span class="mylabel">Department</span>
                          <p id="employee_department">${escapeHtml(
                            employeeData.department || ""
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
                            employeeData.employee_name || ""
                          )}</p>
                          <span class="mylabel">Employee ID</span>
                          <p id="employee_id">${escapeHtml(
                            frm.doc.custodian_2 || ""
                          )}</p>
                          <span class="mylabel">Designation</span>
                          <p id="employee_designation">${escapeHtml(
                            employeeData.designation || ""
                          )}</p><hr>
                        </div>
                        <div>
                          <span class="mylabel">Phone</span>
                          <p id="employee_phone">${escapeHtml(
                            employeeData.cell_number || ""
                          )}</p>
                          <span class="mylabel">Region</span>
                          <p id="employee_region">${escapeHtml(
                            employeeData.region || ""
                          )}</p>
                          <span class="mylabel">Division</span>
                          <p id="employee_division">${escapeHtml(
                            employeeData.division || ""
                          )}</p><hr>
                        </div>
                        <div>
                          <span class="mylabel">District</span>
                          <p id="employee_district">${escapeHtml(
                            employeeData.district || ""
                          )}</p>
                          <span class="mylabel">Branch</span>
                          <p id="employee_branch">${escapeHtml(
                            employeeData.branch || ""
                          )}</p>
                          <span class="mylabel">Department</span>
                          <p id="employee_department">${escapeHtml(
                            employeeData.department || ""
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
      }
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
      }
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
      }
    );
  },

  validate: function (frm) {
    //let custodian_1 = frm.doc.custodian_1;
  },
});

frappe.ui.form.on("CMS", {
  onload: function (frm) {
    frm.set_query("bank_name", "cheque_details", function (doc, cdt, cdn) {
      return {
        filters: {
          branch: frm.doc.branch,
        },
      };
    });
  },
});
