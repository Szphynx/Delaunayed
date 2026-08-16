{
 "patcher": {
  "fileversion": 1,
  "appversion": {
   "major": 8,
   "minor": 6,
   "revision": 0,
   "architecture": "x64",
   "modernui": 1
  },
  "classnamespace": "box",
  "rect": [
   60.0,
   80.0,
   1000.0,
   680.0
  ],
  "openinpresentation": 1,
  "default_fontsize": 11.0,
  "default_fontface": 0,
  "default_fontname": "Arial",
  "gridonopen": 1,
  "gridsize": [
   15.0,
   15.0
  ],
  "gridsnaponopen": 1,
  "objectsnaponopen": 1,
  "statusbarvisible": 2,
  "toolbarvisible": 1,
  "lefttoolbarpinned": 0,
  "toptoolbarpinned": 0,
  "righttoolbarpinned": 0,
  "bottomtoolbarpinned": 0,
  "toolbars_unpinned_last_save": 0,
  "tallnewobj": 0,
  "boxanimatetime": 200,
  "enablehscroll": 1,
  "enablevscroll": 1,
  "devicewidth": 650.0,
  "description": "",
  "digest": "",
  "tags": "",
  "style": "",
  "subpatcher_template": "",
  "assistshowspatchername": 0,
  "boxes": [
   {
    "box": {
     "id": "obj-1",
     "maxclass": "newobj",
     "numinlets": 0,
     "numoutlets": 2,
     "outlettype": [
      "signal",
      "signal"
     ],
     "patching_rect": [
      40.0,
      40.0,
      60.0,
      22.0
     ],
     "text": "plugin~"
    }
   },
   {
    "box": {
     "id": "obj-2",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "signal"
     ],
     "patching_rect": [
      40.0,
      80.0,
      44.0,
      22.0
     ],
     "text": "+~"
    }
   },
   {
    "box": {
     "id": "obj-3",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "signal"
     ],
     "patching_rect": [
      40.0,
      112.0,
      52.0,
      22.0
     ],
     "text": "*~ 0.5"
    }
   },
   {
    "box": {
     "id": "obj-4",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 2,
     "outlettype": [
      "signal",
      "signal"
     ],
     "patching_rect": [
      40.0,
      150.0,
      150.0,
      22.0
     ],
     "text": "poly~ dlny.voice 16"
    }
   },
   {
    "box": {
     "id": "obj-5",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "signal"
     ],
     "patching_rect": [
      40.0,
      300.0,
      40.0,
      22.0
     ],
     "text": "*~"
    }
   },
   {
    "box": {
     "id": "obj-6",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "signal"
     ],
     "patching_rect": [
      86.0,
      300.0,
      40.0,
      22.0
     ],
     "text": "*~"
    }
   },
   {
    "box": {
     "id": "obj-7",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "signal"
     ],
     "patching_rect": [
      150.0,
      300.0,
      40.0,
      22.0
     ],
     "text": "*~"
    }
   },
   {
    "box": {
     "id": "obj-8",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "signal"
     ],
     "patching_rect": [
      196.0,
      300.0,
      40.0,
      22.0
     ],
     "text": "*~"
    }
   },
   {
    "box": {
     "id": "obj-9",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "signal"
     ],
     "patching_rect": [
      40.0,
      340.0,
      40.0,
      22.0
     ],
     "text": "+~"
    }
   },
   {
    "box": {
     "id": "obj-10",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "signal"
     ],
     "patching_rect": [
      86.0,
      340.0,
      40.0,
      22.0
     ],
     "text": "+~"
    }
   },
   {
    "box": {
     "id": "obj-11",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 0,
     "outlettype": [],
     "patching_rect": [
      40.0,
      380.0,
      66.0,
      22.0
     ],
     "text": "plugout~"
    }
   },
   {
    "box": {
     "id": "obj-12",
     "maxclass": "live.dial",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      300.0,
      40.0,
      46.0,
      48.0
     ],
     "presentation": 1,
     "presentation_rect": [
      332.0,
      24.0,
      46.0,
      48.0
     ],
     "varname": "u_drywet",
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Dry/Wet",
       "parameter_shortname": "Dry/Wet",
       "parameter_type": 0,
       "parameter_mmin": 0.0,
       "parameter_mmax": 100.0,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        50.0
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-13",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      360.0,
      46.0,
      54.0,
      22.0
     ],
     "text": "/ 100."
    }
   },
   {
    "box": {
     "id": "obj-14",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      "signal"
     ],
     "patching_rect": [
      360.0,
      80.0,
      44.0,
      22.0
     ],
     "text": "sig~"
    }
   },
   {
    "box": {
     "id": "obj-15",
     "maxclass": "newobj",
     "numinlets": 3,
     "numoutlets": 1,
     "outlettype": [
      "signal"
     ],
     "patching_rect": [
      360.0,
      112.0,
      140.0,
      22.0
     ],
     "text": "rampsmooth~ 128 128"
    }
   },
   {
    "box": {
     "id": "obj-16",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      430.0,
      80.0,
      46.0,
      22.0
     ],
     "text": "!- 1."
    }
   },
   {
    "box": {
     "id": "obj-17",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      "signal"
     ],
     "patching_rect": [
      430.0,
      112.0,
      44.0,
      22.0
     ],
     "text": "sig~"
    }
   },
   {
    "box": {
     "id": "obj-18",
     "maxclass": "newobj",
     "numinlets": 3,
     "numoutlets": 1,
     "outlettype": [
      "signal"
     ],
     "patching_rect": [
      430.0,
      150.0,
      140.0,
      22.0
     ],
     "text": "rampsmooth~ 128 128"
    }
   },
   {
    "box": {
     "id": "obj-19",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      250.0,
      112.0,
      92.0,
      22.0
     ],
     "text": "loadmess 0.5"
    }
   },
   {
    "box": {
     "id": "obj-20",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      250.0,
      150.0,
      92.0,
      22.0
     ],
     "text": "loadmess 0.5"
    }
   },
   {
    "box": {
     "id": "obj-21",
     "maxclass": "live.dial",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      560.0,
      40.0,
      46.0,
      48.0
     ],
     "presentation": 1,
     "presentation_rect": [
      384.0,
      24.0,
      46.0,
      48.0
     ],
     "varname": "u_feedback",
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Feedback",
       "parameter_shortname": "Feedback",
       "parameter_type": 0,
       "parameter_mmin": 0.0,
       "parameter_mmax": 95.0,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        30.0
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-22",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      560.0,
      92.0,
      54.0,
      22.0
     ],
     "text": "/ 100."
    }
   },
   {
    "box": {
     "id": "obj-23",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      560.0,
      124.0,
      80.0,
      22.0
     ],
     "text": "setfb $1"
    }
   },
   {
    "box": {
     "id": "obj-24",
     "maxclass": "live.dial",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      630.0,
      40.0,
      46.0,
      48.0
     ],
     "presentation": 1,
     "presentation_rect": [
      436.0,
      24.0,
      46.0,
      48.0
     ],
     "varname": "u_glide",
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Glide",
       "parameter_shortname": "Glide",
       "parameter_type": 0,
       "parameter_mmin": 0.0,
       "parameter_mmax": 800.0,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        80.0
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-25",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      630.0,
      92.0,
      92.0,
      22.0
     ],
     "text": "setglide $1"
    }
   },
   {
    "box": {
     "id": "obj-26",
     "maxclass": "live.dial",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      700.0,
      40.0,
      46.0,
      48.0
     ],
     "presentation": 1,
     "presentation_rect": [
      488.0,
      24.0,
      46.0,
      48.0
     ],
     "varname": "u_width",
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Width",
       "parameter_shortname": "Width",
       "parameter_type": 0,
       "parameter_mmin": 0.0,
       "parameter_mmax": 150.0,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        100.0
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-27",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      700.0,
      92.0,
      54.0,
      22.0
     ],
     "text": "/ 100."
    }
   },
   {
    "box": {
     "id": "obj-28",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      700.0,
      124.0,
      92.0,
      22.0
     ],
     "text": "setwidth $1"
    }
   },
   {
    "box": {
     "id": "obj-29",
     "maxclass": "live.numbox",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      770.0,
      40.0,
      60.0,
      22.0
     ],
     "presentation": 1,
     "presentation_rect": [
      546.0,
      26.0,
      56.0,
      18.0
     ],
     "varname": "u_tempo",
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Tempo",
       "parameter_shortname": "Tempo",
       "parameter_type": 1,
       "parameter_mmin": 40.0,
       "parameter_mmax": 220.0,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        110.0
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-30",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      770.0,
      72.0,
      70.0,
      22.0
     ],
     "text": "bpm $1"
    }
   },
   {
    "box": {
     "id": "obj-31",
     "maxclass": "live.numbox",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      770.0,
      108.0,
      60.0,
      22.0
     ],
     "presentation": 1,
     "presentation_rect": [
      546.0,
      62.0,
      44.0,
      18.0
     ],
     "varname": "u_taps",
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Taps",
       "parameter_shortname": "Taps",
       "parameter_type": 1,
       "parameter_mmin": 3.0,
       "parameter_mmax": 16.0,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        6.0
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-32",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      770.0,
      140.0,
      74.0,
      22.0
     ],
     "text": "count $1"
    }
   },
   {
    "box": {
     "id": "obj-33",
     "maxclass": "live.tab",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      850.0,
      40.0,
      120.0,
      22.0
     ],
     "presentation": 1,
     "presentation_rect": [
      332.0,
      92.0,
      128.0,
      18.0
     ],
     "varname": "u_time",
     "parameter_enable": 1,
     "saved_attribute_attributes": {
      "valueof": {
       "parameter_longname": "Time",
       "parameter_shortname": "Time",
       "parameter_type": 2,
       "parameter_mmin": 0.0,
       "parameter_mmax": 2.0,
       "parameter_initial_enable": 1,
       "parameter_initial": [
        1.0
       ],
       "parameter_enum": [
        "1/2x",
        "1x",
        "2x"
       ]
      }
     }
    }
   },
   {
    "box": {
     "id": "obj-34",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      850.0,
      72.0,
      130.0,
      22.0
     ],
     "text": "expr pow(2.,$i1-1.)"
    }
   },
   {
    "box": {
     "id": "obj-35",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      850.0,
      104.0,
      90.0,
      22.0
     ],
     "text": "settime $1"
    }
   },
   {
    "box": {
     "id": "obj-36",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      850.0,
      150.0,
      60.0,
      22.0
     ],
     "text": "regen",
     "presentation": 1,
     "presentation_rect": [
      470.0,
      92.0,
      58.0,
      18.0
     ]
    }
   },
   {
    "box": {
     "id": "obj-37",
     "maxclass": "toggle",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      "int"
     ],
     "patching_rect": [
      930.0,
      150.0,
      24.0,
      24.0
     ],
     "presentation": 1,
     "presentation_rect": [
      546.0,
      91.0,
      20.0,
      20.0
     ]
    }
   },
   {
    "box": {
     "id": "obj-38",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      958.0,
      150.0,
      74.0,
      22.0
     ],
     "text": "drift $1"
    }
   },
   {
    "box": {
     "id": "obj-39",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 1,
     "outlettype": [
      "bang"
     ],
     "patching_rect": [
      40.0,
      460.0,
      66.0,
      22.0
     ],
     "text": "loadbang"
    }
   },
   {
    "box": {
     "id": "obj-40",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      40.0,
      492.0,
      50.0,
      22.0
     ],
     "text": "init"
    }
   },
   {
    "box": {
     "id": "obj-41",
     "maxclass": "jsui",
     "numinlets": 1,
     "numoutlets": 2,
     "outlettype": [
      "",
      ""
     ],
     "patching_rect": [
      300.0,
      200.0,
      300.0,
      140.0
     ],
     "presentation": 1,
     "presentation_rect": [
      12.0,
      22.0,
      300.0,
      140.0
     ],
     "filename": "dlny.map.js",
     "parameter_enable": 0
    }
   },
   {
    "box": {
     "id": "obj-42",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 2,
     "outlettype": [
      "",
      ""
     ],
     "patching_rect": [
      700.0,
      470.0,
      70.0,
      22.0
     ],
     "text": "route sel"
    }
   },
   {
    "box": {
     "id": "obj-43",
     "maxclass": "newobj",
     "numinlets": 1,
     "numoutlets": 5,
     "outlettype": [
      "",
      "",
      "",
      "",
      ""
     ],
     "patching_rect": [
      700.0,
      502.0,
      140.0,
      22.0
     ],
     "text": "unpack 0 0 0 0 0"
    }
   },
   {
    "box": {
     "id": "obj-44",
     "maxclass": "number",
     "numinlets": 1,
     "numoutlets": 2,
     "outlettype": [
      "",
      "bang"
     ],
     "patching_rect": [
      700.0,
      540.0,
      50.0,
      22.0
     ],
     "presentation": 1,
     "presentation_rect": [
      332.0,
      132.0,
      44.0,
      18.0
     ]
    }
   },
   {
    "box": {
     "id": "obj-45",
     "maxclass": "number",
     "numinlets": 1,
     "numoutlets": 2,
     "outlettype": [
      "",
      "bang"
     ],
     "patching_rect": [
      760.0,
      540.0,
      50.0,
      22.0
     ],
     "presentation": 1,
     "presentation_rect": [
      392.0,
      132.0,
      44.0,
      18.0
     ]
    }
   },
   {
    "box": {
     "id": "obj-46",
     "maxclass": "flonum",
     "numinlets": 1,
     "numoutlets": 2,
     "outlettype": [
      "",
      "bang"
     ],
     "patching_rect": [
      820.0,
      540.0,
      60.0,
      22.0
     ],
     "presentation": 1,
     "presentation_rect": [
      452.0,
      132.0,
      56.0,
      18.0
     ]
    }
   },
   {
    "box": {
     "id": "obj-47",
     "maxclass": "flonum",
     "numinlets": 1,
     "numoutlets": 2,
     "outlettype": [
      "",
      "bang"
     ],
     "patching_rect": [
      890.0,
      540.0,
      60.0,
      22.0
     ],
     "presentation": 1,
     "presentation_rect": [
      516.0,
      132.0,
      56.0,
      18.0
     ]
    }
   },
   {
    "box": {
     "id": "obj-48",
     "maxclass": "flonum",
     "numinlets": 1,
     "numoutlets": 2,
     "outlettype": [
      "",
      "bang"
     ],
     "patching_rect": [
      960.0,
      540.0,
      60.0,
      22.0
     ],
     "presentation": 1,
     "presentation_rect": [
      582.0,
      132.0,
      44.0,
      18.0
     ]
    }
   },
   {
    "box": {
     "id": "obj-49",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      700.0,
      572.0,
      54.0,
      22.0
     ],
     "text": "set $1"
    }
   },
   {
    "box": {
     "id": "obj-50",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      760.0,
      572.0,
      54.0,
      22.0
     ],
     "text": "set $1"
    }
   },
   {
    "box": {
     "id": "obj-51",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      820.0,
      572.0,
      54.0,
      22.0
     ],
     "text": "set $1"
    }
   },
   {
    "box": {
     "id": "obj-52",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      890.0,
      572.0,
      54.0,
      22.0
     ],
     "text": "set $1"
    }
   },
   {
    "box": {
     "id": "obj-53",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      960.0,
      572.0,
      54.0,
      22.0
     ],
     "text": "set $1"
    }
   },
   {
    "box": {
     "id": "obj-54",
     "maxclass": "newobj",
     "numinlets": 3,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      760.0,
      604.0,
      70.0,
      22.0
     ],
     "text": "clip 0 11"
    }
   },
   {
    "box": {
     "id": "obj-55",
     "maxclass": "newobj",
     "numinlets": 3,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      820.0,
      604.0,
      100.0,
      22.0
     ],
     "text": "clip 200 12000"
    }
   },
   {
    "box": {
     "id": "obj-56",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      890.0,
      604.0,
      54.0,
      22.0
     ],
     "text": "/ 100."
    }
   },
   {
    "box": {
     "id": "obj-57",
     "maxclass": "newobj",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      "float"
     ],
     "patching_rect": [
      960.0,
      604.0,
      54.0,
      22.0
     ],
     "text": "/ 100."
    }
   },
   {
    "box": {
     "id": "obj-58",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      760.0,
      636.0,
      84.0,
      22.0
     ],
     "text": "edit di $1"
    }
   },
   {
    "box": {
     "id": "obj-59",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      820.0,
      636.0,
      90.0,
      22.0
     ],
     "text": "edit cut $1"
    }
   },
   {
    "box": {
     "id": "obj-60",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      890.0,
      636.0,
      90.0,
      22.0
     ],
     "text": "edit pan $1"
    }
   },
   {
    "box": {
     "id": "obj-61",
     "maxclass": "message",
     "numinlets": 2,
     "numoutlets": 1,
     "outlettype": [
      ""
     ],
     "patching_rect": [
      960.0,
      636.0,
      84.0,
      22.0
     ],
     "text": "edit fb $1"
    }
   },
   {
    "box": {
     "id": "obj-62",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "outlettype": [],
     "patching_rect": [
      560.0,
      690.0,
      320.0,
      18.0
     ],
     "text": "DELAUNAY  \u00b7  drag the map, click a node to edit",
     "presentation": 1,
     "presentation_rect": [
      12.0,
      6.0,
      300.0,
      13.0
     ],
     "fontsize": 9.0
    }
   },
   {
    "box": {
     "id": "obj-63",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "outlettype": [],
     "patching_rect": [
      560.0,
      712.0,
      76.0,
      18.0
     ],
     "text": "TEMPO",
     "presentation": 1,
     "presentation_rect": [
      546.0,
      14.0,
      56.0,
      11.0
     ],
     "fontsize": 8.0
    }
   },
   {
    "box": {
     "id": "obj-64",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "outlettype": [],
     "patching_rect": [
      560.0,
      734.0,
      64.0,
      18.0
     ],
     "text": "TAPS",
     "presentation": 1,
     "presentation_rect": [
      546.0,
      50.0,
      44.0,
      11.0
     ],
     "fontsize": 8.0
    }
   },
   {
    "box": {
     "id": "obj-65",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "outlettype": [],
     "patching_rect": [
      560.0,
      756.0,
      60.0,
      18.0
     ],
     "text": "TIME",
     "presentation": 1,
     "presentation_rect": [
      332.0,
      80.0,
      40.0,
      11.0
     ],
     "fontsize": 8.0
    }
   },
   {
    "box": {
     "id": "obj-66",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "outlettype": [],
     "patching_rect": [
      560.0,
      778.0,
      78.0,
      18.0
     ],
     "text": "REGEN",
     "presentation": 1,
     "presentation_rect": [
      470.0,
      80.0,
      58.0,
      11.0
     ],
     "fontsize": 8.0
    }
   },
   {
    "box": {
     "id": "obj-67",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "outlettype": [],
     "patching_rect": [
      560.0,
      800.0,
      60.0,
      18.0
     ],
     "text": "DRIFT",
     "presentation": 1,
     "presentation_rect": [
      570.0,
      93.0,
      40.0,
      11.0
     ],
     "fontsize": 8.0
    }
   },
   {
    "box": {
     "id": "obj-68",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "outlettype": [],
     "patching_rect": [
      560.0,
      822.0,
      64.0,
      18.0
     ],
     "text": "sel",
     "presentation": 1,
     "presentation_rect": [
      332.0,
      120.0,
      44.0,
      11.0
     ],
     "fontsize": 8.0
    }
   },
   {
    "box": {
     "id": "obj-69",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "outlettype": [],
     "patching_rect": [
      560.0,
      844.0,
      64.0,
      18.0
     ],
     "text": "div",
     "presentation": 1,
     "presentation_rect": [
      392.0,
      120.0,
      44.0,
      11.0
     ],
     "fontsize": 8.0
    }
   },
   {
    "box": {
     "id": "obj-70",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "outlettype": [],
     "patching_rect": [
      560.0,
      866.0,
      76.0,
      18.0
     ],
     "text": "cut",
     "presentation": 1,
     "presentation_rect": [
      452.0,
      120.0,
      56.0,
      11.0
     ],
     "fontsize": 8.0
    }
   },
   {
    "box": {
     "id": "obj-71",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "outlettype": [],
     "patching_rect": [
      560.0,
      888.0,
      76.0,
      18.0
     ],
     "text": "pan",
     "presentation": 1,
     "presentation_rect": [
      516.0,
      120.0,
      56.0,
      11.0
     ],
     "fontsize": 8.0
    }
   },
   {
    "box": {
     "id": "obj-72",
     "maxclass": "comment",
     "numinlets": 1,
     "numoutlets": 0,
     "outlettype": [],
     "patching_rect": [
      560.0,
      910.0,
      64.0,
      18.0
     ],
     "text": "fb",
     "presentation": 1,
     "presentation_rect": [
      582.0,
      120.0,
      44.0,
      11.0
     ],
     "fontsize": 8.0
    }
   }
  ],
  "lines": [
   {
    "patchline": {
     "source": [
      "obj-1",
      0
     ],
     "destination": [
      "obj-2",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-1",
      1
     ],
     "destination": [
      "obj-2",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-2",
      0
     ],
     "destination": [
      "obj-3",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-3",
      0
     ],
     "destination": [
      "obj-4",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-41",
      0
     ],
     "destination": [
      "obj-4",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-4",
      0
     ],
     "destination": [
      "obj-5",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-4",
      1
     ],
     "destination": [
      "obj-6",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-1",
      0
     ],
     "destination": [
      "obj-7",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-1",
      1
     ],
     "destination": [
      "obj-8",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-15",
      0
     ],
     "destination": [
      "obj-5",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-15",
      0
     ],
     "destination": [
      "obj-6",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-18",
      0
     ],
     "destination": [
      "obj-7",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-18",
      0
     ],
     "destination": [
      "obj-8",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-5",
      0
     ],
     "destination": [
      "obj-9",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-7",
      0
     ],
     "destination": [
      "obj-9",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-6",
      0
     ],
     "destination": [
      "obj-10",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-8",
      0
     ],
     "destination": [
      "obj-10",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-9",
      0
     ],
     "destination": [
      "obj-11",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-10",
      0
     ],
     "destination": [
      "obj-11",
      1
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-12",
      0
     ],
     "destination": [
      "obj-13",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-13",
      0
     ],
     "destination": [
      "obj-14",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-14",
      0
     ],
     "destination": [
      "obj-15",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-13",
      0
     ],
     "destination": [
      "obj-16",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-16",
      0
     ],
     "destination": [
      "obj-17",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-17",
      0
     ],
     "destination": [
      "obj-18",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-19",
      0
     ],
     "destination": [
      "obj-14",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-20",
      0
     ],
     "destination": [
      "obj-17",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-21",
      0
     ],
     "destination": [
      "obj-22",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-22",
      0
     ],
     "destination": [
      "obj-23",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-23",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-24",
      0
     ],
     "destination": [
      "obj-25",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-25",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-26",
      0
     ],
     "destination": [
      "obj-27",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-27",
      0
     ],
     "destination": [
      "obj-28",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-28",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-29",
      0
     ],
     "destination": [
      "obj-30",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-30",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-31",
      0
     ],
     "destination": [
      "obj-32",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-32",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-33",
      0
     ],
     "destination": [
      "obj-34",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-34",
      0
     ],
     "destination": [
      "obj-35",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-35",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-36",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-37",
      0
     ],
     "destination": [
      "obj-38",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-38",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-39",
      0
     ],
     "destination": [
      "obj-40",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-40",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-41",
      1
     ],
     "destination": [
      "obj-42",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-42",
      0
     ],
     "destination": [
      "obj-43",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-43",
      0
     ],
     "destination": [
      "obj-49",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-49",
      0
     ],
     "destination": [
      "obj-44",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-43",
      1
     ],
     "destination": [
      "obj-50",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-50",
      0
     ],
     "destination": [
      "obj-45",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-43",
      2
     ],
     "destination": [
      "obj-51",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-51",
      0
     ],
     "destination": [
      "obj-46",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-43",
      3
     ],
     "destination": [
      "obj-52",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-52",
      0
     ],
     "destination": [
      "obj-47",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-43",
      4
     ],
     "destination": [
      "obj-53",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-53",
      0
     ],
     "destination": [
      "obj-48",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-45",
      0
     ],
     "destination": [
      "obj-54",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-54",
      0
     ],
     "destination": [
      "obj-58",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-58",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-46",
      0
     ],
     "destination": [
      "obj-55",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-55",
      0
     ],
     "destination": [
      "obj-59",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-59",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-47",
      0
     ],
     "destination": [
      "obj-56",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-56",
      0
     ],
     "destination": [
      "obj-60",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-60",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-48",
      0
     ],
     "destination": [
      "obj-57",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-57",
      0
     ],
     "destination": [
      "obj-61",
      0
     ]
    }
   },
   {
    "patchline": {
     "source": [
      "obj-61",
      0
     ],
     "destination": [
      "obj-41",
      0
     ]
    }
   }
  ]
 }
}