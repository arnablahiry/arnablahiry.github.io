Quickstart
==========

The entire public API is one function, :func:`galaxy_textures.make_galaxy`,
plus the :data:`galaxy_textures.CLASSES` list of class names.

Generate a single image
------------------------

.. code-block:: python

   import torch
   from galaxy_textures import CLASSES, make_galaxy

   torch.manual_seed(0)
   img = make_galaxy(kind=1, size=128)
   # img is a torch.Tensor with shape (1, 128, 128)

``kind`` is an integer index into :data:`~galaxy_textures.CLASSES`:

.. code-block:: python

   >>> CLASSES
   ['elliptical', 'spiral', 'barred spiral', 'merger', 'edge-on', 'irregular']

Merger-only overrides
----------------------

The merger class (``kind=3``) accepts two extra keyword arguments that have
no effect on the other classes:

.. code-block:: python

   img = make_galaxy(kind=3, size=128, stage=0.8, merger_barred=True)

* ``stage`` — interaction progress, roughly ``0`` (early passage) to ``1``
  (late-stage, strongly disturbed).
* ``merger_barred`` — if set, one member of the pair is rendered as a barred
  spiral instead of a plain spiral.

Rendering a grid of examples
------------------------------

``examples/render_grid.py`` samples all six classes and saves them as one
grid image, which is the fastest way to sanity-check a change:

.. code-block:: bash

   python examples/render_grid.py --out galaxy_textures_grid.png
