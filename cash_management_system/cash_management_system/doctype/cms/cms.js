frappe.ui.form.on("CMS", {
  onload: function (frm) {
    // If the form is new, refresh the window
    if (frm.is_new()) {
      window.location.reload(); // Refreshes the page
    }
  },
  refresh: function (frm) {
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
  show_approval_tracker: function (frm) {
    // Extract data from the form
    const step_1_status = frm.doc.status === "Draft" ? "Pending" : "Approved";
    const step_2_status =
      frm.doc.stage_1_emp_status === "Pending" ? "Pending" : "Approved";
    const step_3_status =
      frm.doc.stage_2_emp_status === "Pending" ? "Pending" : "Approved";
    const step_4_status =
      frm.doc.status === "Approved" ? "Approved" : "Pending";

    console.log("step 1:", step_1_status);
    console.log("step 2:", step_2_status);
    console.log("step 3:", step_3_status);
    console.log("step 4:", step_4_status);

    // Generate HTML
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
          width: 80%;
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
          font-weight:bold;
        }
        .progress-step.pending .progress-label {
          color: #999; /* Color for pending steps */
        }
        .progress-bar-container {
          position: absolute;
          top: 20px;
          left: 10px;
          right: 10px;
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
        content: "";
        background-image: url("https://m.media-amazon.com/images/G/01/x-locale/cs/ship-track/pt2/milestone_checkmark_2x._V516143779_.png");
        background-size: 50% 50%; /* Adjusted size */
        background-repeat: no-repeat;
        background-position: center;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        }
        .progress-step.pending .step-circle::after {
          content: "";
          background-image: url("https://cdn-icons-png.flaticon.com/128/14090/14090215.png");
          background-size: 100% 100%; /* Adjusted size */
          background-repeat: no-repeat;
          background-position: center;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
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
          </div>
          <div class="progress-step" id="step-3">
              <div class="step-circle"></div>
              <div class="progress-label">HO Approval</div>
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
      
      if (statuses["step-1"] === "Approved") {
        width = 35;
      }
      if (statuses["step-2"] === "Approved") {
        width = 65;
      }
      if (statuses["step-3"] === "Approved") {
        width = 95;
      }
         if (statuses["step-4"] === "Approved") {
        width = 100;
      }
      if (statuses["step-1"] === "Pending") {
        width = 5;
      }
      
      // Update the status for each step
      let pendingFound = false;
      steps.forEach((step, index) => {
        if (statuses[step.id] === "Approved") {
          step.classList.add("completed");
          step.classList.remove("pending");
        } else if (!pendingFound) {
          step.classList.add("pending");
          step.classList.remove("completed");
          pendingFound = true; // Only the first pending step should show the pending image
        } else {
          step.classList.remove("pending");
          step.classList.remove("completed");
        }
      });

      // Set the width of the progress bar based on the calculated value
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
            frm.disable_form();
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
    frm.fields_dict["approvable_movement_changes"].$input.on(
      "keydown",
      function (event) {
        var key = event.key;
        var amountField = frm.fields_dict["approvable_movement_changes"];

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
