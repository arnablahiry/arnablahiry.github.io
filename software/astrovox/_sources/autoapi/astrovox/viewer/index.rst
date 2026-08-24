astrovox.viewer
===============

.. py:module:: astrovox.viewer


Classes
-------

.. autoapisummary::

   astrovox.viewer.KinematicVolumeViewer


Functions
---------

.. autoapisummary::

   astrovox.viewer.load_fits_cube
   astrovox.viewer.load_cube_with_metadata
   astrovox.viewer.numpy_cube_count


Module Contents
---------------

.. py:class:: KinematicVolumeViewer(cube, vel_scale: Optional[float] = None, opacity='sigmoid', cmap='plasma', plotter: Optional[pyvista.Plotter] = None, show_moment0: bool = False, embed_controls: bool = True, axis_labels: Optional[tuple] = None, spatial_scale: Optional[tuple] = None, colorbar_title: str = 'Intensity', axis_ranges: Optional[tuple] = None, axis_label_formats: Optional[tuple] = None, axis_tick_formatters: Optional[tuple] = None, axis_tick_units: Optional[tuple] = None)

   Standalone 3D viewer for kinematic spectral cubes with a light/dark theme toggle.


   .. py:attribute:: opacity
      :value: 'sigmoid'



   .. py:attribute:: cmap
      :value: 'plasma'



   .. py:attribute:: show_moment0
      :value: False



   .. py:attribute:: embed_controls
      :value: True



   .. py:attribute:: axis_labels
      :value: ('X', 'Y', 'Z')



   .. py:attribute:: spatial_scale
      :value: None



   .. py:attribute:: colorbar_title
      :value: 'Intensity'



   .. py:attribute:: axis_ranges


   .. py:attribute:: axis_label_formats
      :value: ('%.2f', '%.2f', '%.1f')



   .. py:attribute:: axis_tick_formatters


   .. py:attribute:: axis_tick_units


   .. py:attribute:: colorbar_visible
      :value: True



   .. py:attribute:: scalebar_visible
      :value: True



   .. py:attribute:: mini_axes_visible
      :value: True



   .. py:attribute:: show_main_axes_labels
      :value: False



   .. py:attribute:: show_axis_ticks
      :value: False



   .. py:attribute:: show_grid_lines
      :value: False



   .. py:attribute:: cube_axes_actor
      :value: None



   .. py:attribute:: cube


   .. py:attribute:: vel_scale
      :value: None



   .. py:attribute:: grid


   .. py:attribute:: d_min


   .. py:attribute:: d_max


   .. py:attribute:: value_scale
      :value: 'linear'



   .. py:attribute:: current_clim


   .. py:attribute:: is_dark_theme
      :value: False



   .. py:attribute:: plotter


   .. py:attribute:: cube_outline_visible
      :value: True



   .. py:attribute:: cube_outline_thickness
      :value: 1



   .. py:attribute:: cube_outline_style
      :value: 'solid'



   .. py:attribute:: bbox_actor
      :value: None



   .. py:method:: toggle_theme(state)


   .. py:method:: set_theme(is_dark: bool)

      Externally driven theme switch (e.g. from a host GUI's own toggle button).



   .. py:method:: set_clim(vmin: float, vmax: float)

      Externally driven clim update (e.g. from a host GUI's own
      sliders). Rebuilds just the volume's small (256-entry) colour/
      opacity lookup table in place rather than the whole volume actor
      — a full rebuild re-uploads the entire 3D scalar texture to the
      GPU, expensive enough that dragging vmin/vmax while a rotation
      animation is running visibly stutters the rotation.



   .. py:method:: set_opacity(opacity)

      Externally driven opacity-transfer-function update (e.g. from a
      host GUI's own Linear/Log/Power selector). Accepts anything
      PyVista's ``add_volume(opacity=...)`` accepts: a preset name or an
      array of per-scalar opacity values.



   .. py:method:: set_value_scale(mode: str)

      Switch the volume's data-to-colour mapping (and, in turn, the
      colorbar) between "linear" and "log10" — distinct from the
      Linear/Log/Power *opacity* transfer function (set_opacity),
      which only reshapes alpha falloff and leaves colour mapping
      linear regardless. vmin/vmax (current_clim) stay in real,
      linear units always; only the mapping is log.



   .. py:method:: set_cmap(cmap: str)

      Externally driven colormap update (e.g. from a host GUI's own
      colormap dropdown).



   .. py:method:: apply_theme()


   .. py:method:: set_mini_axes_visible(visible: bool)

      Show/hide the small bottom-left orientation-widget triad.



   .. py:method:: set_main_axes_labels_visible(visible: bool)

      Toggle the axis *name* labels (e.g. "RA"/"Dec"/"km/s") on the
      main cube's own 3 dynamically-chosen edges — independent of the
      numeric tick marks/values (see set_axis_ticks_visible).



   .. py:method:: set_axis_ticks_visible(visible: bool)

      Toggle tick marks + numeric tick-value labels on the main
      cube's 3 dynamically-chosen edges.



   .. py:method:: set_grid_lines_visible(visible: bool)

      Toggle faint (low-opacity) grid lines spanning the volume.



   .. py:method:: set_colorbar_visible(visible: bool)

      Toggle the top-right colorbar (swatch + border/ticks + title).



   .. py:method:: set_scalebar_visible(visible: bool)

      Toggle the top-left scale bar (bracket + length label).



   .. py:method:: set_spatial_scale(value_per_voxel: float, unit: str)

      Supply (or replace) the physical length a voxel spans, e.g.
      after the user fills in "Field of view" for a numpy cube that
      was loaded with no spatial scale at all — the scale bar actors
      are only ever built once a scale exists in the first place.



   .. py:method:: set_manual_axis_scale(axis_idx: int, value_per_voxel: float, unit_text: str, centered: bool = False)

      Give a numpy-array cube's otherwise-unitless axis (raw voxel-
      index ticks) real physical units, once the user has supplied
      Field of view (for the spatial axes) or Spectral Resolution (for
      the velocity axis) plus a unit — the same custom tick/title
      machinery already used for FITS/HDF5 cubes' RA/Dec/velocity
      axes, just populated interactively rather than at load time.
      ``unit_text`` is shown, LaTeX-rendered (matplotlib mathtext), in
      parentheses after that axis's title, e.g. "X ($M_\odot/h$)".
      ``centered``: a spatial (Field of view) axis's ticks run 0 -> N
      from one vertex of the cube; the velocity (Spectral Resolution)
      axis instead centres on systemic velocity, -N/2 -> N/2 — pass
      True for that one.



   .. py:method:: clear_manual_axis_scale(axis_idx: int)

      Revert one axis back to raw voxel-index ticks — used when the
      user clears its Field of view/unit or Spectral Resolution/unit
      fields, or switches Type of cube to PPP (no velocity axis).



   .. py:method:: set_colorbar_title(title: str)

      Change the colorbar's title text, e.g. once the user fills in
      "Quantity Units" for a numpy cube that started with a blank
      title.



   .. py:method:: set_cube_outline_visible(visible: bool)

      Toggle the wireframe box outlining the volume's bounds.



   .. py:method:: set_cube_outline_thickness(width: float)


   .. py:method:: set_cube_outline_style(style: str)


   .. py:method:: redraw_volume(render: bool = True)


   .. py:method:: redraw_moment0()


   .. py:method:: redraw_sliders(text_color)


   .. py:method:: show(**kwargs)


.. py:function:: load_fits_cube(cube_path: str | pathlib.Path)

.. py:function:: load_cube_with_metadata(cube_path: str | pathlib.Path, cube_index: int = 0)

   Load a cube (FITS, HDF5, or a bare numpy array) plus whatever
   observational metadata its header/attrs expose. Returns ``(cube,
   info, extra)``:

   - ``info``: an ordered dict of only the display fields that were
     actually present — callers should skip any key that's missing
     rather than assume a fixed set.
   - ``extra``: ``{"axis_labels": (x, y, z), "spatial_scale":
     (value_per_voxel, unit) | None}`` for the viewer's axes/scale bar.

   ``cube_index`` only applies to a .npy/.npz file holding more than
   one volumetric cube (see numpy_cube_count) — ignored otherwise.


.. py:function:: numpy_cube_count(cube_path: pathlib.Path) -> int

   How many separate volumetric cubes this .npy/.npz file holds —
   either multiple arrays in an .npz, or a single 4D array stacking
   several cubes along axis 0. 1 if it's just one plain cube.


