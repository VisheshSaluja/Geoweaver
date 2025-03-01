/**
 * This file is dedicated to manage the prompt process dialog.
 * This is a separate file to avoid messing with the gw.process.js and existing function.
 * All the DIV containers are brand new for the prompt panel.
 * !!! Don't ever share the same Div id with the normal process window !!!
 */

GW.process.sidepanel = {
  current_workflow_history_id: null,
  current_workflow_process_id: null,
  current_process_id: null,
  current_process_name: null,
  current_process_category: null,
  dockmode: "no",

  isResizing: false,
  startX: null,
  startWidth: null,

  editor: null,

  init: function () {},

  // Show a banner with buttons to choose between versions
  // Show a floating banner with buttons to choose between versions in the code editor
  showVersionChoiceBanner: function(history_id) {
    const bannerHTML = `
        <div id="versionBanner" class="floating-banner">
            <span class="banner-close-btn" id="closeBanner">&times;</span>
            <p>You are viewing the latest code version, and the log shown is for ID: <strong>${history_id}</strong>. To view a previous version, click the "Details" button in the history table.</p>
        </div>
    `;
    // Add banner to the body
    $('body').prepend(bannerHTML);

    // Close the banner when the close icon is clicked
    $('#closeBanner').click(function() {
        $('#versionBanner').fadeOut(300, function() {
            $(this).remove();
        });
    });

    // Set a flag to track whether the mouse is over the banner
    let isMouseOverBanner = false;

    // Stop auto-closing when the mouse enters the banner
    $('#versionBanner').on('mouseenter', function() {
        isMouseOverBanner = true;
    });

    // Allow auto-closing when the mouse leaves the banner
    $('#versionBanner').on('mouseleave', function() {
        isMouseOverBanner = false;
    });

    // Hide the banner after 5 seconds if no action is taken and the mouse is not over the banner
    setTimeout(function() {
        if ($('#versionBanner').length > 0 && !isMouseOverBanner) {
            $('#versionBanner').fadeOut(300, function() {
                $(this).remove();
            });
        }
    }, 3000);

    // // Optionally, add event listeners for the buttons if users want to select
    // $('#viewHistoryVersion').click(function() {
    //     this.loadVersion('history');
    //     $('#versionBanner').fadeOut(300, function() {
    //         $(this).remove();
    //     });
    // }.bind(this));

    // $('#viewLatestVersion').click(function() {
    //     this.loadVersion('latest');
    //     $('#versionBanner').fadeOut(300, function() {
    //         $(this).remove();
    //     });
    // }.bind(this));
  },

  open_panel: function (
    workflow_history_id,
    workflow_process_id,
    process_name,
  ) {
    console.log(
      workflow_history_id + " " + workflow_process_id + " " + process_name,
    );
    this.current_workflow_history_id = workflow_history_id;
    this.current_workflow_process_id = workflow_process_id;
    this.current_process_id = workflow_process_id.split("-")[0];
    this.current_process_name = process_name;


    $.ajax({
      url: "detail",

      method: "POST",

      data: "type=process&id=" + this.current_process_id,
    }).done(function (msg) {
      msg = $.parseJSON(msg);

      GW.process.sidepanel.display(msg);

      GW.process.sidepanel.showProcessLog(
        GW.process.sidepanel.current_workflow_history_id,
        GW.process.sidepanel.current_workflow_process_id,
        GW.process.sidepanel.current_process_name,
      );

      GW.process.sidepanel.dockmode == "bottom";
      GW.process.sidepanel.renderDock();
    });
  },

  editSwitch: function () {
    if (this.isPresent) {
      this.update();
    }
  },

  update: function () {
    if (this.isPresent()) {
      var pcode = GW.process.sidepanel.getCode();

      var confidential = "FALSE"; // this is very rarely used right now. May improve in future.

      if (this.current_process_id != null) {
        if (this.current_process_lang == "builtin") {
          GW.process.updateBuiltin();
        } else {
          GW.process.updateRaw(
            this.current_process_id,
            this.current_process_name,
            this.current_process_lang,
            this.current_process_description,
            pcode,
            confidential,
          );
        }
      }
    }
  },

  showHistoryDetails: function (history_id) {
    GW.process.history_id = history_id;

    $.ajax({
      url: "log",

      method: "POST",

      data: "type=process&id=" + history_id,
    })
      .done(function (msg) {
        if (msg == "") {
          alert("Cannot find the process history in the database.");

          return;
        }

        msg = GW.general.parseResponse(msg);

        msg.code = msg.input;

        GW.process.history_id = msg.hid;

        GW.process.sidepanel.display(msg);

        GW.process.sidepanel.displayOutput(msg);

        if (GW.editor.isfullscreen) {
          GW.process.sidepanel.dockmode = "left";
          GW.process.sidepanel.renderDock();
        } else {
          // keep the dock location as is
          // GW.process.sidepanel.dockmode = "bottom";
          // GW.process.sidepanel.renderDock();
        }
      })
      .fail(function (jxr, status) {
        console.error("Fail to get log.");
      });
  },

  displayOutput: function (msg) {
    var output = GW.general.escapeCodeforHTML(msg.output);

    GW.process.history_id = msg.hid;

    if (msg.output == "logfile") {
      output =
        '<div class="spinner-border" role="status"> ' +
        '	  <span class="sr-only">Loading...</span> ' +
        "	</div>";
    }

    console.log("Update the code with the old version");

    if (GW.process.sidepanel.editor) {
      GW.process.sidepanel.editor.setValue(GW.process.unescape(msg.input));

      // GW.process.util.refreshCodeEditor();
    }

    output =
      "<p> Execution started at " +
      msg.begin_time +
      "</p>" +
      "<p> Execution ended at " +
      msg.end_time +
      "</p>" +
      "<p> The old code used has been refreshed in the code editor.</p>" +
      "<div>" +
      output +
      "</div>";

    $("#prompt-panel-process-log-window").html(output);

    $("#retrieve-result").click(function () {
      GW.result.showDialog(history_id);
    });

    if (msg.output == "logfile") {
      $.get("../temp/" + msg.id + ".log")
        .success(function (data) {
          if (data != null) $("#log-output").text(data);
          else $("#log-output").text("missing log");
        })
        .error(function () {
          $("#log-output").text("missing log");
        });
    }
  },

  showProcessLog: function (workflow_history_id, process_id, process_title) {
    if (workflow_history_id == null) {
      $("#prompt_panel_log_switch").prop("checked", false).trigger("change");
    } else {
      $.ajax({
        url: "workflow_process_log",

        method: "POST",

        data:
          "workflowid=" +
          GW.workflow.loaded_workflow +
          "&workflowhistoryid=" +
          workflow_history_id +
          "&processid=" +
          process_id,
        })
        .done(function (msg) {
          msg = GW.general.parseResponse(msg);

          if ("history_output" in msg && msg.history_output != null) {
            GW.process.history_id = msg.history_id;

            msgout = msg.history_output.replaceAll("\n", "<br/>");

            $("#prompt-panel-process-log-window").append(msgout);
            // Show banner with buttons for version choice
            GW.process.sidepanel.showVersionChoiceBanner(msg.history_id);
          } else {
            $("#prompt_panel_log_switch")
              .prop("checked", false)
              .trigger("change");
          }
        })
        .fail(function (msg) {
          $("#prompt_panel_log_switch")
            .prop("checked", false)
            .trigger("change");
        });
    }

    $.ajax({
      url: "check_workflow_process_skipped",

      method: "POST",

      data:
        "workflowid=" +
        GW.workflow.loaded_workflow +
        "&processid=" +
        process_id,
    }).done(function (msg) {
      msg = GW.general.parseResponse(msg);

      if (msg.if_skipped) {
        $("#prompt_panel_skip_process_" + process_id).prop("checked", true);
      } else {
        $("#prompt_panel_skip_process_" + process_id).prop("checked", false);
      }
    });
  },

  /**
   * Keep consistent with gw.process
   * @param {} msg
   */
  display: function (msg) {
    let code_type = msg.lang == null ? msg.description : msg.lang;

    GW.process.sidepanel.current_process_description = msg.description;

    GW.process.sidepanel.current_process_lang = msg.lang;

    GW.process.sidepanel.current_process_category = code_type;

    GW.ssh.current_process_log_length = 0;

    GW.process.process_id = this.current_process_id

    // do not stop ability to add process when we open side panel
    // GW.workspace.currentmode = 2;

    GW.process.history_id = null;

    GW.ssh.process_output_id = "prompt-panel-process-log-window";

    let code = msg.code;

    if (code != null && code.includes('\\"')) {
      code = GW.process.unescape(code);
    }

    $("#prompt-panel").addClass("cd-panel--is-visible");

    $("#prompt-panel-main").html("");

    // add process code and history combo
    let process_code_history_content =
      `
      <div id="resize-btn"></div>
      <div id="prompt-panel-editor-history-tab-panel" style="height:100%; width:100%; margin:0; padding: 0; background-color: white;">

        <div class="subtab tab titleshadow" style="margin-top: 0; max-width: 100%">
          
          <button class="tablinks-process" id="prompt-panel-main-process-info-code-tab" onclick="GW.process.openCity(event, 'prompt-panel-main-process-info-code')">`+ 
            GW.process.util.get_icon_by_process_type(code_type) +` `+ this.current_process_name+`</button>
                
          <button class="tablinks-process" id="prompt-panel-main-process-info-history-tab" onclick="GW.process.openCity(event, 'prompt-panel-main-process-info-history'); GW.process.sidepanel.history('` +
            this.current_process_id +
            `', '` +
            this.current_process_name +
          `')">History</button>
          
          <!-- TODO: play button, save button, full screen button-->
          <button class="btn pull-right" onclick="GW.process.sidepanel.close()" >
					  <i class="glyphicon glyphicon-remove"></i>
				  </button>
          <button class="btn pull-right" onclick="GW.editor.switchSidePanelFullScreen()" >
            <i class="glyphicon glyphicon-fullscreen"></i>
          </button>
            <button class="btn pull-right" 
                title="dock log window on bottom" onclick="GW.process.sidepanel.bottomDock()" >
                <i class="fas fa-window-maximize"></i>
            </button>
            <button class="btn pull-right" title="dock log window on right" onclick="GW.process.sidepanel.leftDock()" >
                <i class="fas fa-window-maximize fa-rotate-270"></i>
            </button>
            <button class="btn pull-right" title="edit switch" onclick="GW.process.sidepanel.editSwitch()" >
                <i class="glyphicon glyphicon-floppy-saved"></i>
            </button>
            <button class="btn pull-right" title="skip it in workflow" onclick="javascript:void(0)">
                Skip: <input type="checkbox"
                    onClick='GW.workflow.skipprocess("` +
      this.current_workflow_history_id +
      `", "` +
      this.current_workflow_process_id +
      `");'  
                        id="prompt_panel_skip_process_` +
      this.current_workflow_process_id +
      `" />
                </button>
                <button class="btn pull-right" title="switch on/off log" onclick="javascript:void(0)">
                    Log: <input type="checkbox" id="prompt_panel_log_switch" checked="checked" />
                </button>
                <button class="btn pull-right" title="download code" onclick="GW.process.sidepanel.getCodeAndLog()">
                <i class="glyphicon glyphicon-download"></i>
            </button>  
              <button class="btn pull-right" title="execute process" onclick="GW.process.sidepanel.runProcess('` +
      this.current_process_id +
      `', '` +
      this.current_process_name +
      `', '` +
      code_type +
      `');" >
                    <i class="glyphicon glyphicon-play"></i>
                </button>
            </div>

            <div id="prompt-panel-main-process-info-code" class="tabcontent-process generalshadow" style="height:100%;left:0; margin:0; padding: 0; ">
                <div class="code__container" style="font-size: 12px; margin:0; height:100%;" id="prompt-panel-code-history-section">
                    <div id="prompt-panel-process_code_window" class="container__left" style="height:100%; padding:0; scrollbar-color: rgb(28, 28, 28);" >
                        <div class="col col-md-6" id="prompt-panel-code-embed" style="width:100%; margin-top:5px; padding: 0px; margin: 0px; height: calc(100%-50px);" ></div>
                    </div>
                    <div class="resizer" id="prompt-panel-dragMe"></div>
                    <div id="prompt-panel-single-console-content" class="container__right" 
                    style="height:100%; overflow-y: scroll; scrollbar-color: var(--monaco-scrollbar-color); background-color: var(--monaco-background-color); color: var(--monaco-foreground-color);"
                    >
                        <h4>Logging</h4>
                        <div id="prompt-panel-process-log-window" style="overflow-wrap: break-word; height: calc(100% - 50px); overflow-y: unset; background-color: var(--monaco-editor-background-color); color: var(--monaco-editor-foreground-color);"> </div>
                        <div class="row" style="padding:0px; margin:0px;" >
                            <div class="col col-md-12" id="prompt-panel-console-output"  style="width:100%; padding:0px; margin:0px; height:calc(100%-50px); " >
                                <div class="d-flex justify-content-center"><div class="dot-flashing invisible"></div></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="prompt-panel-main-process-info-history" class="tabcontent-process generalshadow" style="height:100%; overflow-y: scroll; left:0; margin:0; padding: 0; display:none;">
                <div class="row" id="prompt-panel-process-history-container" style="display: 'none'; padding:0; color:white; margin:0; background-color:rgb(28, 28, 28);" ></div>
                <div id="history-tab-loader-process-detail" style="display: 'flex'; flex: 1; height: 100px; width: 100px; position: absolute; top: -100px; bottom: 0; left: 0; right: 0; margin: auto; flex-direction: column;">
                	<img src="../gif/loading-spinner-black.gif" style="height: 6rem;" alt="loading..." />
					<h5 style="width: 100vw; margin-left: -75px; margin-top: 0">Please wait while we fetch the history</h5>
				</div>
            </div>

            <div id="prompt-panel-execution_context"></div>
        </div>`;

    
    $("#prompt-panel-main").append(process_code_history_content);

    // fill in values
    $("#prompt-panel-processcategory").val(code_type);

    $("#prompt-panel-processname").val(this.current_process_name);

    $("#prompt-panel-processid").val(this.current_process_id);

    $("#prompt-panel-main-process-info-code").hide().fadeIn("fast"); // refresh to make height full

    GW.process.util.displayCodeArea(
      code_type,
      code,
      "#prompt-panel-code-embed",
      "#prompt-panel-process_code_window",
    );

    // make the side panel default full screen
    GW.editor.forceSidePanelFullScreen(GW.editor.isfullscreen)

    // activate buttons
    $("#prompt_panel_log_switch").change(function () {
      if (GW.process.sidepanel.dockmode == "left") {
        if (!this.checked) {
          $(".container__right").hide();
          $(".container__left").css("width", "100%");
        } else {
          $(".container__right").show();
          $(".container__left").css("width", "60%");
        }
      } else if (GW.process.sidepanel.dockmode == "bottom") {
        if (!this.checked) {
          $(".container__right").hide();
          $(".container__left").css("height", "100%");
        } else {
          $(".container__right").show();
          $(".container__left").css("height", "60%");
        }
      }
    });

    this.enablePanelResizer()

  },

  // Mouse move event to resize the panel
  onMouseMove: function(e) {
    if (GW.process.sidepanel.isResizing) {
        const newWidth = GW.process.sidepanel.startWidth + (GW.process.sidepanel.startX - e.clientX);
        // Set the new width only if it's within a reasonable range
        if (newWidth > 100 && newWidth < window.innerWidth) {
          GW.process.sidepanel.panel.style.width = `${newWidth}px`;
        }
    }
  },

  // Mouse up event to stop resizing
  onMouseUp: function () {
      document.removeEventListener('mousemove', GW.process.sidepanel.onMouseMove);
      document.removeEventListener('mouseup', GW.process.sidepanel.onMouseUp);
  },

  enablePanelResizer: function(){
    // Getting the DOM elements
    GW.process.sidepanel.panel = document.getElementById('prompt-panel-main').parentElement;
    const resizeBtn = document.getElementById('resize-btn');

    GW.process.sidepanel.isResizing = false;
    
    // Mouse down event to start resizing
    resizeBtn.addEventListener('mousedown', (e) => {
      GW.process.sidepanel.isResizing = true;
      GW.process.sidepanel.startX = e.clientX;
      GW.process.sidepanel.startWidth = GW.process.sidepanel.panel.offsetWidth;
      document.addEventListener('mousemove', GW.process.sidepanel.onMouseMove);
      document.addEventListener('mouseup', GW.process.sidepanel.onMouseUp);
      e.preventDefault(); // Prevent text selection or other actions while dragging
    });

    
  },

  /**
   * Show a Run process dialog
   * @param {*} pid
   * @param {*} pname
   * @param {*} lang
   */
  runProcess: function (pid, pname, lang) {
    GW.process.process_id = pid;
    GW.process.sidepanel.editSwitch();
    GW.process.runProcess(
      pid,
      pname,
      lang,
      GW.process.sidepanel.executeCallback,
    );
  },

  executeCallback: function (encrypt, req, dialogItself, button) {
    req.pswd = encrypt;

    $("#prompt_panel_log_switch").prop("checked", true).trigger("change");

    $("#prompt-panel-process-log-window").html(""); //clean up the log out area

    GW.ssh.process_output_id = "prompt-panel-process-log-window";

    GW.ssh.current_process_log_length = 0;

    GW.process.sendExecuteRequest(req, dialogItself, button);
  },

  getCode: function () {
    var code = null;

    if (GW.process.sidepanel.current_process_category == "shell") {
      code = GW.process.sidepanel.editor.getValue();
    } 
    else if (GW.process.sidepanel.current_process_category == "builtin") {
      var params = [];

      $(".parameter").each(function () {
        var newparam = {
          name: $(this).attr("id").split("param_")[1].split(cmid)[0],

          value: $(this).val(),
        };

        params.push(newparam);
      });

      code = {
        operation: $("#builtin_processes").val(),

        params: params,
      };

      code = JSON.stringify(code);
    } else if (GW.process.sidepanel.current_process_category == "jupyter") {
      code = JSON.stringify(GW.process.jupytercode);
    } else if (GW.process.sidepanel.current_process_category == "python") {
      code = GW.process.sidepanel.editor.getValue();
    }

    return code;
  },


  switchFullScreen: function () {
    GW.editor.switchFullScreenUtil(
      "#prompt-panel-editor-history-tab-panel",
      "#prompt-panel-main-process-info-code",
      "#prompt-panel-main-process-info-history",
    );
  },

  renderDock: function () {
    if (GW.process.sidepanel.dockmode == "no") {
      GW.process.util.noDock(
        "prompt-panel-code-history-section",
        "prompt-panel-process_code_window",
        "prompt-panel-single-console-content",
        "prompt-panel-dragMe",
      );
    } else if (GW.process.sidepanel.dockmode == "left") {
      GW.process.util.leftDock(
        "prompt-panel-code-history-section",
        "prompt-panel-process_code_window",
        "prompt-panel-single-console-content",
        "prompt-panel-dragMe",
      );
    } else if (GW.process.sidepanel.dockmode == "bottom") {
      GW.process.util.bottomDock(
        "prompt-panel-code-history-section",
        "prompt-panel-process_code_window",
        "prompt-panel-single-console-content",
        "prompt-panel-dragMe",
      );
    }
  },

  noDock: function () {
    GW.process.sidepanel.dockmode = "no";
    GW.process.sidepanel.renderDock();
  },

  leftDock: function () {
    if (GW.process.sidepanel.dockmode != "left") {
      GW.process.util.leftDock(
        "prompt-panel-code-history-section",
        "prompt-panel-process_code_window",
        "prompt-panel-single-console-content",
        "prompt-panel-dragMe",
      );
      GW.process.sidepanel.dockmode = "left";
    } else {
      GW.process.sidepanel.noDock();
    }
  },

  bottomDock: function () {
    if (GW.process.sidepanel.dockmode != "bottom") {
      GW.process.util.bottomDock(
        "prompt-panel-code-history-section",
        "prompt-panel-process_code_window",
        "prompt-panel-single-console-content",
        "prompt-panel-dragMe",
      );
      GW.process.sidepanel.dockmode = "bottom";
    } else {
      GW.process.sidepanel.noDock();
    }
  },

  history: function (process_id, process_name) {
    GW.process.util.history(
      process_id,
      process_name,
      "#prompt-panel-process-history-container",
      "#process_history_table",
      "#closeHistory",
      "prompt-panel-main-process-info-history-tab",
      "prompt-panel-main-process-info-history",
    );
  },

  close: function () {
    $("#prompt-panel").removeClass("cd-panel--is-visible");
  },

  isPresent: function () {
    return $("#prompt-panel").hasClass("cd-panel--is-visible");
  },
  getCodeAndLog: function(){
    var code = this.getCode();
    var log = $("#prompt-panel-process-log-window").html();
    var code_log = code + "\n\n" + log;
    var blob = new Blob([code_log], {type: "text/plain;charset=utf-8"});

    let ext = "";
    if (this.current_process_category == "python") {
      ext = ".py";
    }
    if (this.current_process_category == "shell") {
      ext = ".sh";
    }

    saveAs(blob, this.current_process_name + ext); // need ext to download the file with extension correctly. If ext is not identified we can leave it as txt
  },
};
