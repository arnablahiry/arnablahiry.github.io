        document.getElementById("year").textContent = new Date().getFullYear();

        // Handle start button hover and click for sidebar opacity
        const startButton = document.querySelector('.start-button');
        const sidebar = document.querySelector('.home-left-sidebar');
        const startPrompt = document.getElementById('start-prompt');
        
        if (startButton && sidebar) {
          startButton.addEventListener('mouseenter', () => {
            sidebar.classList.add('start-hovered');
          });
          
          startButton.addEventListener('mouseleave', () => {
            sidebar.classList.remove('start-hovered');
            if (!sidebar.classList.contains('start-clicked')) {
              sidebar.classList.remove('start-hovered');
            }
          });
          
          startButton.addEventListener('click', () => {
            sidebar.classList.add('start-clicked');
            sidebar.classList.remove('start-hovered');
            
            // Add unlocked class to stop pulsing and dim the text
            startButton.classList.add('unlocked');
            if (startPrompt) {
              startPrompt.classList.add('unlocked');
            }
          });
        }
