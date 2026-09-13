(() => {
  const space = document.getElementById("space");
  const look = document.getElementById("look");
  if (!space || !look) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const layers = [...look.querySelectorAll("[data-depth]")];
  const maxYaw = 11;
  const maxPitch = 6;

  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let dragging = false;
  let dragOriginX = 0;
  let dragOriginY = 0;
  let dragFromX = 0;
  let dragFromY = 0;

  function norm(clientX, clientY) {
    return {
      nx: (clientX / window.innerWidth) * 2 - 1,
      ny: (clientY / window.innerHeight) * 2 - 1,
    };
  }

  function aim(clientX, clientY) {
    const { nx, ny } = norm(clientX, clientY);
    targetX = Math.max(-1, Math.min(1, nx));
    targetY = Math.max(-1, Math.min(1, ny));
  }

  space.addEventListener("pointerdown", (event) => {
    dragging = true;
    space.setPointerCapture(event.pointerId);
    const { nx, ny } = norm(event.clientX, event.clientY);
    dragOriginX = nx;
    dragOriginY = ny;
    dragFromX = targetX;
    dragFromY = targetY;
  });

  space.addEventListener("pointerup", () => {
    dragging = false;
  });

  space.addEventListener("pointercancel", () => {
    dragging = false;
  });

  space.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen" || dragging) {
      if (!dragging) return;
      const { nx, ny } = norm(event.clientX, event.clientY);
      targetX = Math.max(-1, Math.min(1, dragFromX + (nx - dragOriginX)));
      targetY = Math.max(-1, Math.min(1, dragFromY + (ny - dragOriginY)));
      return;
    }
    aim(event.clientX, event.clientY);
  });

  function frame() {
    x += (targetX - x) * 0.07;
    y += (targetY - y) * 0.07;

    look.style.transform = `rotateY(${-x * maxYaw}deg) rotateX(${y * maxPitch}deg)`;

    for (const layer of layers) {
      const depth = Number(layer.dataset.depth) || 0;
      const shiftX = -x * 36 * depth;
      const shiftY = -y * 22 * depth;
      layer.style.translate = `${shiftX}px ${shiftY}px`;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
