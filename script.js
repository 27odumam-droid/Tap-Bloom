const scoreElement = document.querySelector('#score');
const bloomButton = document.querySelector('#bloomButton');
const resetButton = document.querySelector('#resetButton');
const streakMessage = document.querySelector('#streakMessage');

let score = 0;

function updateGame() {
  scoreElement.textContent = score;

  if (score === 0) {
    streakMessage.textContent = 'Every garden starts with one.';
  } else if (score < 10) {
    streakMessage.textContent = 'A little bloom is appearing.';
  } else if (score < 25) {
    streakMessage.textContent = 'Your garden is taking shape.';
  } else {
    streakMessage.textContent = 'Look at that garden grow!';
  }
}

bloomButton.addEventListener('click', () => {
  score += 1;
  updateGame();
});

resetButton.addEventListener('click', () => {
  score = 0;
  updateGame();
  bloomButton.focus();
});
