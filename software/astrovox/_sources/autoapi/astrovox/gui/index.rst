astrovox.gui
============

.. py:module:: astrovox.gui


Attributes
----------

.. autoapisummary::

   astrovox.gui.QtCore
   astrovox.gui.QtInteractor
   astrovox.gui.CUBE_FILE_FILTER


Classes
-------

.. autoapisummary::

   astrovox.gui.TrackpadInteractor
   astrovox.gui.SquareViewportContainer
   astrovox.gui.LabeledSlider
   astrovox.gui.PillSelector
   astrovox.gui.ToggleGrid
   astrovox.gui.CubeOutlineRow
   astrovox.gui.PlaybackRow
   astrovox.gui.RecordControl
   astrovox.gui.StaticFrameControl
   astrovox.gui.ExternalLinkIcon
   astrovox.gui.ProjectionControl
   astrovox.gui.ColormapSelector
   astrovox.gui.ThemeButton
   astrovox.gui.ResetButton
   astrovox.gui.LinkButton
   astrovox.gui.Card
   astrovox.gui.ManualInfoForm
   astrovox.gui.PlusIcon
   astrovox.gui.DropZone
   astrovox.gui.ProjectionWindow
   astrovox.gui.CubeViewerApp


Functions
---------

.. autoapisummary::

   astrovox.gui.main


Module Contents
---------------

.. py:data:: QtCore
   :value: None


.. py:data:: QtInteractor
   :value: None


.. py:class:: TrackpadInteractor

   Bases: :py:obj:`pyvistaqt.QtInteractor`


   QtInteractor with native macOS trackpad gestures layered on top
   of PyVista's existing left-drag-to-rotate / scroll-to-zoom: a
   two-finger scroll pans the camera, a pinch (native zoom gesture)
   zooms, and a two-finger twist (native rotate gesture) spins the
   camera rig around the loaded cube's own centre (see set_pivot) —
   not around whatever the focal point drifted to after panning, and
   not around the viewport's centre, which is what a bare
   Camera.Roll() would do. Regular mouse wheels are untouched —
   trackpad scrolling is distinguished from a physical wheel by the
   presence of Qt's high-resolution ``pixelDelta``, which only
   trackpads (and Magic Mouse) populate.


   .. py:method:: set_pivot(point)

      Fix the world-space point that two-finger twist rotates
      around — call this once after loading a cube (e.g. with its
      bounds centre), so rotation stays anchored to the cube even
      after the view has been panned off-centre.



   .. py:method:: wheelEvent(event)


   .. py:method:: event(event)


   .. py:method:: snap_to_axis_plane(plane)

      Jump to a straight-on view of the given coordinate plane
      ("X-Y", "Y-Z", or "X-Z"), looking along its normal axis,
      centred on the cube's pivot and keeping the current zoom
      (distance).



.. py:data:: CUBE_FILE_FILTER
   :value: 'FITS/HDF5/NumPy cubes (*.fits *.fit *.fts *.h5 *.hdf5 *.npy *.npz);;All files (*)'


.. py:class:: SquareViewportContainer(parent=None)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   Hosts a single child widget, always sized/centered as a square
   inscribed in the available space, regardless of window resizing.


   .. py:method:: set_child(widget)


   .. py:method:: clear_child()


   .. py:method:: resizeEvent(event)


.. py:class:: LabeledSlider(symbol_html, minimum, maximum, value, fmt='{:.4g}', parent=None)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   Slider + editable value box: a filled accent pill-bar slider (no
   separate knob) with a bordered entry box beside it. Rather than a
   plain heading above the slider, it's labelled with a small rich-text
   math symbol inline to the slider's left — e.g. V_min, V_max, gamma;
   ``symbol_html`` here is that label, as Qt rich text (e.g.
   ``"V<sub>min</sub>"``).


   .. py:attribute:: valueChanged


   .. py:method:: set_log_scale(enabled: bool)

      Switch the slider's position<->value mapping between linear
      and logarithmic — the stored/emitted value always stays in real
      (linear) units, only how mouse position along the track maps to
      that value changes. Without this, a slider spanning many orders
      of magnitude (typical for astronomical intensity data) is
      unusable in Log mode: almost the entire track corresponds to a
      sliver of the value range.



   .. py:method:: set_range(minimum, maximum, value)


   .. py:method:: value()


   .. py:method:: set_enabled_dimmed(enabled: bool)

      Enable/disable this slider and visually dim it (low opacity)
      when disabled — used for the Power gamma slider, which only
      matters while 'Power' is the selected scale.



   .. py:method:: apply_theme(palette)


.. py:class:: PillSelector(values, selected=None, parent=None, pill_height=24, pill_width=None, pill_padding='2px 10px', expand=False)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   Segmented pill selector: a row of flat rectangular buttons, the
   selected one filled with the accent colour.


   .. py:attribute:: valueChanged


   .. py:method:: current_value()


   .. py:method:: set_selected(value)

      Change the selected pill programmatically, without emitting
      valueChanged. Used when the camera moves for a reason other than
      clicking a snap pill (e.g. manual rotate/pan/zoom), which must
      not re-trigger a snap.



   .. py:method:: refresh_style()

      Force a QSS re-polish on every pill. A *programmatic* setChecked
      (unlike an actual click) doesn't reliably repaint the ":checked"
      pseudo-state — most notably right after construction, before the
      widget has ever been shown, which is why the pills can look jumbled
      on first launch until something (e.g. a theme toggle) forces a
      repaint. Call this once the page holding the pills is actually
      visible to fix that up front.



   .. py:method:: apply_theme(palette)


.. py:class:: ToggleGrid(labels_defaults, parent=None, extra_widget=None)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   A 2-column grid of independently checkable pills — unlike
   PillSelector, these are plain on/off toggles (no exclusive
   group), used for the Visual aesthetics section.


   .. py:attribute:: toggled


   .. py:method:: is_checked(label)


   .. py:method:: column_width() -> int

      Actual on-screen width of one grid column (i.e. one pill) —
      used by CubeOutlineRow to make its own toggle button match.



   .. py:method:: pill_height() -> int

      The fixed height every pill in this grid uses — used by
      CubeOutlineRow to make its own toggle button match.



   .. py:method:: set_pill_enabled(label, enabled: bool)

      Disable/dim (or restore) a single pill. Used to gate the
      Scalebar pill for numpy cubes until a valid field of view has
      been entered.



   .. py:method:: set_checked_silent(label, checked: bool)

      Change a pill's checked state without emitting `toggled` —
      the caller is expected to separately drive whatever the pill
      controls, since a programmatic setChecked() doesn't fire the
      button's own clicked signal.



   .. py:method:: apply_theme(palette)


.. py:class:: CubeOutlineRow(parent=None)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   "Cube Outline" toggle plus its own Thickness/Style dropdowns — a
   standalone row (rather than a ToggleGrid entry, since it needs room
   for two extra dropdowns) in the Visual Aesthetics card. The toggle
   sits in the same grid-column-0 as ToggleGrid's pills (same width),
   with the two dropdowns sharing column 1. Both dropdowns show a
   drawn line sample as their icon (no text) so the thickness/style is
   visible directly in the closed combo box, and dim/become unclickable
   whenever the outline itself is switched off.


   .. py:attribute:: toggled


   .. py:method:: set_toggle_width(width: int)

      Match the toggle pill's width to ToggleGrid's actual rendered
      column width (its own grid, sized independently, doesn't land on
      the same pixel width by construction since its second column
      holds two comboboxes instead of a single pill).



   .. py:method:: set_toggle_height(height: int)

      Match the toggle pill's height to ToggleGrid's own pills, so
      "Cube Outline" doesn't stand out as a different size.



   .. py:method:: is_checked() -> bool


   .. py:method:: thickness() -> int


   .. py:method:: line_style() -> str


   .. py:method:: apply_theme(palette)


.. py:class:: PlaybackRow(label_text, speed=30.0, speed_min=-180.0, speed_max=180.0, speed_step=2.0, parent=None)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   One "<label>: [Play/Pause] − [speed] +" row: a square Play/Pause
   button (accent-filled while playing, plain pill otherwise) plus a
   −/+ stepper flanking an
   editable speed readout (small pill buttons, accent-coloured symbols).
   Used for the Animation section's Azimuth/Elevation auto-rotate rows —
   this widget only exposes play state and speed; CubeViewerApp owns the
   actual camera-rotation timer.


   .. py:attribute:: toggled


   .. py:method:: speed()


   .. py:method:: is_playing()


   .. py:method:: stop()

      Stop playback programmatically (e.g. when resetting back to
      the upload page) — mirrors an actual click on the Play/Pause
      button so CubeViewerApp's own toggled-state bookkeeping (the
      animation timer, Record/Save gating) stays in sync.



   .. py:method:: apply_theme(palette)


.. py:class:: RecordControl(parent=None)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   "Record Video" button that walks through record → 3-2-1 countdown →
   recording → stopped states. This widget owns only the UI/animation
   (countdown ticks, swapping which controls are shown) and emits
   signals at the points that need real action (starting the countdown,
   actually starting/stopping frame capture, saving, resetting) —
   CubeViewerApp owns the actual viewport recording via the signals
   below.

   Row layout, left to right: [accent box] [Save .mp4] [FPS: input].
   The accent box itself doubles as Stop once recording starts (no
   separate Stop control) — "⏺ Record Video" while idle, "⏺ <n>" during
   the countdown, a plain "⏹" while recording (click anywhere on it to
   stop), and "Reset" (no icon) once stopped, which discards the clip
   and returns to idle. "Save .mp4" appears (disabled) from the
   countdown onward and only actually becomes clickable once stopped —
   it's the one thing that keeps the recording. The accent box spans the
   full row while idle; Save and the FPS field are fixed-width, so its
   stretch factor shrinks it to make room for them rather than the row
   growing wider. The FPS field is only editable while idle — the value
   is locked in for the whole clip once recording starts.


   .. py:attribute:: recordClicked


   .. py:method:: fps() -> int


   .. py:method:: start_countdown(seconds: int = 3)


   .. py:method:: enter_recording()


   .. py:method:: reset_idle()


   .. py:method:: set_animation_gate(enabled: bool)

      Recording only makes sense while the cube is actually moving —
      the whole row (record/stop button, Save .mp4, FPS field) is
      disabled and dimmed whenever both animation rows are paused, and
      active again once at least one of them is playing.

      This dims every widget in the row individually rather than
      stacking a second QGraphicsOpacityEffect on the container: Qt's
      software effect compositing breaks (some widgets, particularly
      Fusion-styled ones, silently stop painting at all) when an
      effect-bearing widget is nested inside another effect-bearing
      ancestor.



   .. py:method:: apply_theme(palette)


.. py:class:: StaticFrameControl(parent=None)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   "Save Static Frame" button — a single-shot counterpart to
   RecordControl's video recording: click the accent box to
   immediately grab the current viewport frame (in whatever format the
   locked-in "Format:" dropdown says), then click "Save .<ext>" to write
   it to disk via a save dialog. Unlike video, there's no countdown or
   stop step — capture is instant. Once captured, the accent box turns
   into a plain "Reset" button (no icon), matching RecordControl's
   stopped-state Reset: clicking it just clears back to the initial
   "ready to capture" state rather than capturing again.


   .. py:attribute:: captureClicked


   .. py:method:: format() -> str


   .. py:method:: reset()

      Back to idle — used when a new cube is loaded, so a stale
      frame from the previous cube can't be saved under it.



   .. py:method:: set_animation_gate(enabled: bool)

      The static-frame capture only makes sense while the cube is
      actually still — disabled/dimmed whenever either animation row is
      playing, active again once both are paused.

      Dims every widget in the row individually rather than stacking a
      second QGraphicsOpacityEffect on the container: Qt's software
      effect compositing breaks (some widgets, particularly
      Fusion-styled ones, silently stop painting at all) when an
      effect-bearing widget is nested inside another effect-bearing
      ancestor.



   .. py:method:: apply_theme(palette)


.. py:class:: ExternalLinkIcon(parent=None)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   A small "open in new window" glyph (rounded square, open at the
   top-right corner, with a diagonal arrow escaping through the gap) —
   painted directly rather than a font glyph, same reasoning as
   PlusIcon: guarantees it's centred exactly in its own rect regardless
   of font metrics.


   .. py:method:: set_color(color)


   .. py:method:: paintEvent(event)


.. py:class:: ProjectionControl(parent=None)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   Start/Reset button + a blocky progress bar + a square "open in a
   new window" button — drives the 2D projection / moment-0 computation
   (see CubeViewerApp._on_projection_start_clicked). The progress bar
   stays low-opacity until Start is clicked, and the open button stays
   disabled until the computation actually finishes.


   .. py:attribute:: startClicked


   .. py:method:: set_progress(pct: int)


   .. py:method:: complete()


   .. py:method:: reset()


   .. py:method:: apply_theme(palette)


.. py:class:: ColormapSelector(parent=None)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   Labelled colormap dropdown, styled like the rest of this app's
   controls. Offers a different curated list of colormaps per theme (dark
   maps that fade to black, light maps that fade to white), remembering
   the last choice made in each theme independently.


   .. py:attribute:: valueChanged


   .. py:method:: set_theme_maps(theme_name: str)

      Switch the dropdown's option list to the given theme's curated
      colormaps, restoring that theme's last selection.



   .. py:method:: current_value()


   .. py:method:: apply_theme(palette)


.. py:class:: ThemeButton(parent=None)

   Bases: :py:obj:`QtWidgets.QPushButton if QtWidgets is not None else object`


   Theme toggle button: bordered square showing a sun/moon glyph,
   colours inverting on hover.


   .. py:method:: apply_theme(palette, is_dark: bool)


.. py:class:: ResetButton(parent=None)

   Bases: :py:obj:`QtWidgets.QPushButton if QtWidgets is not None else object`


   Bottom-left "Reset" button, same row as the theme toggle — pastel
   red (rather than accent-coloured) since it's a destructive action:
   discards the current cube and returns to the upload/drop-zone page,
   after a confirmation dialog (see CubeViewerApp._on_reset_clicked).


   .. py:method:: apply_theme(palette)


.. py:class:: LinkButton(text, url, parent=None)

   Bases: :py:obj:`QtWidgets.QPushButton if QtWidgets is not None else object`


   Bottom-row button that opens an external URL — same accent
   styling as the theme toggle (border colour, hover-inverts), used for
   "Docs" and "GitHub" alongside Reset and the theme button.


   .. py:method:: apply_theme(palette)


.. py:class:: Card(parent=None, faint_border=False)

   Bases: :py:obj:`QtWidgets.QFrame if QtWidgets is not None else object`


   Bordered card wrapper: a thin accent-bordered outline around a
   padded content area.


   .. py:method:: layout_for_content()


   .. py:method:: apply_theme(palette)


.. py:class:: ManualInfoForm(parent=None)

   Bases: :py:obj:`Card if QtWidgets is not None else object`


   Editable metadata form shown for every loaded cube — pre-filled
   from whatever a FITS/HDF5 header actually provided (see prefill()),
   or left blank/"$$" for a numpy array, which carries no header/attrs
   at all. Field of view feeds the scale bar and Quantity Units feeds
   the colorbar title once filled in; Spectral Resolution only unlocks
   once the cube type indicates a velocity axis (anything but PPP).
   For a numpy cube, Field of view/Spectral Resolution also feed the
   axis tick labels/titles directly (see
   KinematicVolumeViewer.set_manual_axis_scale) — for a FITS/HDF5 cube,
   those two fields stay purely informational/editable, since its own
   RA/Dec/velocity (or kpc) axis system is already correct.


   .. py:attribute:: fovChanged


   .. py:method:: name() -> str


   .. py:method:: telescope() -> str


   .. py:method:: cube_type() -> str


   .. py:method:: quantity_name() -> str


   .. py:method:: quantity_unit() -> str


   .. py:method:: prefill(info: dict, extra: dict)

      Populate every field from whatever metadata a FITS/HDF5
      header actually provided — the same editable textbox UI as a
      numpy cube, just pre-filled instead of starting blank. Anything
      the header didn't supply is simply left at its default (blank,
      or "$$" for a unit field).



   .. py:method:: reset(default_name: str = '')

      Back to blank — called each time a new numpy cube is loaded so
      stale values from a previous one can't linger. Name is
      pre-filled with the file's own name as a convenient default,
      rather than starting empty.



   .. py:method:: apply_theme(palette)


.. py:class:: PlusIcon(parent=None)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   A '+' drawn directly (two crossed rounded bars) rather than a font
   glyph — a QLabel's "+" text is centred by Qt using the font's full
   ascent/descent box, which for most fonts isn't visually symmetric
   around the glyph itself, leaving the character looking off-centre no
   matter how its container is aligned. Painting it ourselves guarantees
   it sits exactly in the middle of this widget's own rect.


   .. py:method:: set_color(color: PyQt5.QtGui.QColor)


   .. py:method:: paintEvent(event)


.. py:class:: DropZone(parent=None)

   Bases: :py:obj:`QtWidgets.QWidget if QtWidgets is not None else object`


   Blank landing page: a low-opacity '+' watermark, drop instructions,
   and a Browse button. Shown before any cube is loaded.


   .. py:attribute:: browseRequested


   .. py:method:: apply_theme(palette)


.. py:class:: ProjectionWindow(result, is_dark, parent=None)

   Bases: :py:obj:`QtWidgets.QMainWindow if QtWidgets is not None else object`


   Standalone window for a computed 2D projection / moment-0 map
   (see CubeViewerApp._compute_projection) — a static dataset separate
   from the live 3D volume, so it gets its own small controls column
   (Field of view, Vmin/Vmax, Scale, Colormap, and a Grid Lines/
   Colorbar/Scalebar aesthetics toggle row) reusing the same widget
   classes the main viewer's own column is built from, rather than the
   3D viewer's own state.


.. py:class:: CubeViewerApp

   Bases: :py:obj:`QtWidgets.QMainWindow if QtWidgets is not None else object`


   Blank-on-launch window: a drag-and-drop landing page until a cube is
   loaded, then a square interactive PyVista viewport with a right-hand
   controls column (info, clim sliders, opacity-scale pills, theme
   toggle) — never drawn inside the render window itself.


   .. py:attribute:: drop_zone


   .. py:attribute:: viewport


   .. py:attribute:: manual_info_form


   .. py:attribute:: vmin_slider


   .. py:attribute:: vmax_slider


   .. py:attribute:: scale_selector


   .. py:attribute:: gamma_slider


   .. py:attribute:: colormap_selector


   .. py:attribute:: axis_snap_label


   .. py:attribute:: axis_snap_selector


   .. py:attribute:: aesthetics_card


   .. py:attribute:: aesthetics_label


   .. py:attribute:: aesthetics_toggles


   .. py:attribute:: cube_outline_row


   .. py:attribute:: animation_card


   .. py:attribute:: animation_label


   .. py:attribute:: azimuth_row


   .. py:attribute:: elevation_row


   .. py:attribute:: export_card


   .. py:attribute:: export_label


   .. py:attribute:: record_control


   .. py:attribute:: static_frame_control


   .. py:attribute:: projection_card


   .. py:attribute:: projection_label


   .. py:attribute:: projection_control


   .. py:attribute:: reset_button


   .. py:attribute:: docs_button


   .. py:attribute:: github_button


   .. py:attribute:: theme_button


   .. py:attribute:: plotter
      :value: None



   .. py:attribute:: viewer
      :value: None



   .. py:method:: dragEnterEvent(event)


   .. py:method:: dropEvent(event)


   .. py:method:: browse_for_cube()


   .. py:method:: render_cube(cube_path: pathlib.Path)


   .. py:method:: toggle_theme()


   .. py:method:: closeEvent(event)


.. py:function:: main(argv: list[str] | None = None) -> int

