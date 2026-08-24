Installation
============

``galaxy-textures`` targets Python 3.9+ and depends on PyTorch, NumPy, and
Matplotlib.

From source
-----------

.. code-block:: bash

   git clone https://github.com/arnablahiry/galaxy-morphology-textures.git
   cd galaxy-morphology-textures
   pip install -e .

Runtime dependencies only
--------------------------

If you just want to import the package without installing it, the runtime
dependencies are listed in ``requirements.txt``:

.. code-block:: bash

   pip install -r requirements.txt

Building the docs
------------------

The documentation site is built with Sphinx and the Furo theme:

.. code-block:: bash

   pip install -r docs/requirements.txt
   sphinx-build -b html docs docs/_build/html
