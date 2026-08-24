Morphology Classes
===================

Each row of the index in :data:`galaxy_textures.CLASSES` maps to one
renderer module. The renderers are deliberately simple, analytic shapes
rather than physical simulations — see :ref:`caveats` for what that trades
away.

.. list-table::
   :header-rows: 1
   :widths: 8 16 20 30

   * - kind
     - name
     - module
     - what it looks like
   * - 0
     - elliptical
     - :mod:`galaxy_textures.elliptical`
     - Smooth bulge with a warped halo
   * - 1
     - spiral
     - :mod:`galaxy_textures.spiral`
     - 2-3 arms, occasional bifurcation, bright knots
   * - 2
     - barred spiral
     - :mod:`galaxy_textures.barred_spiral`
     - Compact bar with arms rooted at the bar ends
   * - 3
     - merger
     - :mod:`galaxy_textures.merger`
     - Two interacting disks with bridge and tails
   * - 4
     - edge-on
     - :mod:`galaxy_textures.edge_on`
     - Thin disk, bulge, dust lane
   * - 5
     - irregular
     - :mod:`galaxy_textures.irregular`
     - Clumpy body with noisy, disturbed structure

Shared machinery for background noise and satellite companions lives in
:mod:`galaxy_textures.shared` and is used across all six renderers.

.. _caveats:

Caveats
-------

These are stylized textures, not simulated observations:

* Single-band grayscale only — no real color cues.
* Gaussian noise is added, but there is no PSF/seeing model.
* Merger structure is a controlled cartoon of tidal interaction, not an
  N-body simulation.
* The classes are cleaner than real survey data on purpose, which makes the
  set better for demos than for benchmarking survey-grade classification.
