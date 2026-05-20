Modelos FBX — opcionales

El juego es en primera persona, así que el personaje no se renderiza visualmente.
Por eso esta carpeta está vacía: ahorra ~34 MB de descarga al cargar el juego.

Si en el futuro quieres reactivar el personaje visible (por ejemplo, para una
vista de tercera persona o para mostrarlo en una cinemática), descarga de
Mixamo y pon aquí:

  - character.fbx   (T-pose con animación idle)
  - Walking.fbx
  - Running.fbx
  - Dance.fbx

Y en src/core/Game.js cambia:
    await this.player.init(true);
por:
    await this.player.init(false);

Y quita la línea:
    this.player.character.group.visible = false;
