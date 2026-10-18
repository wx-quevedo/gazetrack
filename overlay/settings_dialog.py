"""Settings panel for the gaze overlay (PHASE-02A.1).

A normal (focusable, not click-through) dialog to tune the cursor, smoothing
and fade LIVE while watching the overlay react. Each control change emits
configChanged(OverlayConfig); the overlay applies it immediately and the app
persists it (debounced) to data/overlay.yaml.

Spanish UI, sober palette, no emojis - matches the project's professional
look. Sections are independent group boxes so 2B/2C can add more (logging,
alarms) without disturbing this one.
"""

from __future__ import annotations

from dataclasses import replace

from PyQt6 import QtCore, QtGui, QtWidgets

from overlay.config import DEFAULTS, OverlayConfig

# Light theme (project rule: light by default; dark only if asked).
_STYLE = """
QDialog { background: #f4f4f5; }
QWidget { color: #27272a; font-size: 13px; }
QGroupBox {
    border: 1px solid #d4d4d8; border-radius: 6px; margin-top: 14px;
    padding: 10px 12px 12px 12px; background: #ffffff;
}
QGroupBox::title {
    subcontrol-origin: margin; left: 10px; padding: 0 4px;
    color: #52525b; font-weight: 600;
}
QLabel#hint { color: #71717a; font-size: 11px; }
QLabel#shortcut { color: #3f3f46; }
QCheckBox { color: #27272a; }
QSpinBox, QDoubleSpinBox {
    background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px;
    padding: 3px 6px; min-width: 90px; color: #27272a;
}
QPushButton {
    background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px;
    padding: 6px 14px; color: #27272a;
}
QPushButton:hover { background: #eef0f2; }
QPushButton#swatch { min-width: 48px; }
"""


class SettingsDialog(QtWidgets.QDialog):
    configChanged = QtCore.pyqtSignal(object)   # OverlayConfig

    def __init__(self, config: OverlayConfig, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Configuracion - gazetrack")
        self.setWindowFlags(QtCore.Qt.WindowType.Window
                            | QtCore.Qt.WindowType.WindowStaysOnTopHint)
        self.setStyleSheet(_STYLE)
        self.setMinimumWidth(430)
        self._loading = False
        self._color = tuple(config.dot_color)
        # Base config: current_config() overrides only the panel-editable
        # fields onto this, so config fields NOT in the panel (event
        # thresholds set via flags/yaml) are preserved.
        self._base = config

        root = QtWidgets.QVBoxLayout(self)
        root.setSpacing(12)
        root.addWidget(self._cursor_group())
        root.addWidget(self._smoothing_group())
        root.addWidget(self._fade_group())
        root.addWidget(self._logging_group())
        root.addWidget(self._captures_group())
        root.addWidget(self._alarms_group())
        root.addWidget(self._shortcuts_group())
        root.addLayout(self._buttons())

        self.set_from_config(config)

    # --- control builders --------------------------------------------------
    def _spin(self, lo, hi, step, decimals=0, suffix=""):
        box = (QtWidgets.QDoubleSpinBox() if decimals
               else QtWidgets.QSpinBox())
        box.setRange(lo, hi)
        box.setSingleStep(step)
        if decimals:
            box.setDecimals(decimals)
        if suffix:
            box.setSuffix(suffix)
        box.valueChanged.connect(self._on_change)
        return box

    def _row(self, form: QtWidgets.QFormLayout, label: str, widget,
             hint: str = "") -> None:
        form.addRow(label, widget)
        if hint:
            lab = QtWidgets.QLabel(hint)
            lab.setObjectName("hint")
            lab.setWordWrap(True)
            form.addRow("", lab)

    def _cursor_group(self) -> QtWidgets.QGroupBox:
        g = QtWidgets.QGroupBox("Cursor")
        form = QtWidgets.QFormLayout(g)
        self.size = self._spin(10, 120, 2, suffix=" px")
        self.opacity = self._spin(0.1, 1.0, 0.05, decimals=2)
        self.deadzone = self._spin(0, 80, 1, suffix=" px")
        self.swatch = QtWidgets.QPushButton()
        self.swatch.setObjectName("swatch")
        self.swatch.clicked.connect(self._pick_color)
        self._row(form, "Tamano", self.size)
        self._row(form, "Opacidad", self.opacity)
        self._row(form, "Color", self.swatch)
        self._row(form, "Zona muerta", self.deadzone,
                  "El cursor se queda quieto ante movimientos menores a este "
                  "valor (evita el temblor en fijaciones).")
        return g

    def _smoothing_group(self) -> QtWidgets.QGroupBox:
        g = QtWidgets.QGroupBox("Suavizado (One-Euro)")
        form = QtWidgets.QFormLayout(g)
        self.min_cutoff = self._spin(0.1, 10.0, 0.1, decimals=2)
        self.beta = self._spin(0.0, 0.05, 0.001, decimals=3)
        self._row(form, "Suavizado base", self.min_cutoff,
                  "Menor = mas estable pero responde mas lento; mayor = mas "
                  "agil pero menos suave.")
        self._row(form, "Reactividad", self.beta,
                  "Mayor = sigue movimientos rapidos mejor, pero tiembla mas "
                  "en reposo.")
        return g

    def _fade_group(self) -> QtWidgets.QGroupBox:
        g = QtWidgets.QGroupBox("Desvanecimiento")
        form = QtWidgets.QFormLayout(g)
        self.pose_margin = self._spin(0, 30, 1, suffix=" deg")
        self.offscreen = self._spin(0, 30, 1, decimals=1, suffix=" %")
        self.fade_ms = self._spin(50, 1000, 50, suffix=" ms")
        self._row(form, "Margen de pose", self.pose_margin,
                  "Grados de giro de cabeza mas alla del rango calibrado "
                  "antes de que el cursor se desvanezca.")
        self._row(form, "Margen fuera de pantalla", self.offscreen,
                  "Si la prediccion cae mas de este porcentaje del ancho "
                  "fuera de la pantalla, el cursor se desvanece.")
        self._row(form, "Duracion del fade", self.fade_ms)
        return g

    def _logging_group(self) -> QtWidgets.QGroupBox:
        g = QtWidgets.QGroupBox("Registro (grid de zonas de mirada)")
        form = QtWidgets.QFormLayout(g)
        self.grid_cols = self._spin(1, 12, 1)
        self.grid_rows = self._spin(1, 8, 1)
        self._row(form, "Columnas", self.grid_cols)
        self._row(form, "Filas", self.grid_rows,
                  "Divide la pantalla en columnas x filas para atribuir a "
                  "que zona miras. Aplica a la proxima sesion de registro.")
        return g

    def _captures_group(self) -> QtWidgets.QGroupBox:
        g = QtWidgets.QGroupBox("Capturas de eventos (opcional)")
        v = QtWidgets.QVBoxLayout(g)
        self.snapshots = QtWidgets.QCheckBox(
            "Guardar una imagen de la camara al detectar eventos")
        self.snapshots.toggled.connect(self._on_change)
        v.addWidget(self.snapshots)
        info = QtWidgets.QLabel(
            "Desactivado por defecto. Si lo activas, al detectar eventos "
            "(ausencia, distraccion, bloque de foco) se guarda un fotograma "
            "de tu rostro en data/snapshots/. Las imagenes son 100% locales, "
            "NUNCA salen de esta maquina, y se borran automaticamente segun "
            "la retencion. Los eventos se registran siempre; solo la imagen "
            "es opcional.")
        info.setObjectName("hint")
        info.setWordWrap(True)
        v.addWidget(info)
        form = QtWidgets.QFormLayout()
        self.retention = self._spin(1, 365, 1, suffix=" dias")
        self.burst = self._spin(1, 3, 1, suffix=" fotograma(s)")
        self._row(form, "Retencion", self.retention)
        self._row(form, "Rafaga por evento", self.burst)
        v.addLayout(form)
        return g

    def _alarms_group(self) -> QtWidgets.QGroupBox:
        g = QtWidgets.QGroupBox("Alarmas")
        v = QtWidgets.QVBoxLayout(g)
        self.alarm = QtWidgets.QCheckBox(
            "Avisar tras tiempo continuo fuera de pantalla")
        self.alarm.toggled.connect(self._on_change)
        v.addWidget(self.alarm)
        info = QtWidgets.QLabel(
            "Notificacion sobria de Windows (sin sonidos estridentes, "
            "desactivable) cuando llevas demasiado tiempo sin mirar la "
            "pantalla durante una sesion de registro.")
        info.setObjectName("hint")
        info.setWordWrap(True)
        v.addWidget(info)
        form = QtWidgets.QFormLayout()
        self.alarm_min = self._spin(1, 120, 1, suffix=" min")
        self._row(form, "Umbral off-screen", self.alarm_min)
        v.addLayout(form)
        return g

    def _shortcuts_group(self) -> QtWidgets.QGroupBox:
        g = QtWidgets.QGroupBox("Atajos de teclado")
        v = QtWidgets.QVBoxLayout(g)
        for text in ("Mostrar / ocultar cursor:  Ctrl+Alt+G",
                     "Abrir configuracion:  Ctrl+Alt+S",
                     "Salir:  Ctrl+Alt+Q"):
            lab = QtWidgets.QLabel(text)
            lab.setObjectName("shortcut")
            v.addWidget(lab)
        note = QtWidgets.QLabel("La edicion de atajos llegara en una version "
                                "futura.")
        note.setObjectName("hint")
        v.addWidget(note)
        return g

    def _buttons(self) -> QtWidgets.QHBoxLayout:
        row = QtWidgets.QHBoxLayout()
        restore = QtWidgets.QPushButton("Restaurar valores por defecto")
        restore.clicked.connect(self._restore_defaults)
        close = QtWidgets.QPushButton("Cerrar")
        close.clicked.connect(self.hide)
        row.addWidget(restore)
        row.addStretch(1)
        row.addWidget(close)
        return row

    # --- state <-> controls ------------------------------------------------
    def _apply_swatch(self) -> None:
        r, g, b = self._color
        self.swatch.setText(f"{r},{g},{b}")
        self.swatch.setStyleSheet(
            f"#swatch {{ background: rgb({r},{g},{b}); color: "
            f"{'#000' if (r + g + b) > 380 else '#fff'}; }}")

    def set_from_config(self, cfg: OverlayConfig) -> None:
        self._loading = True
        self._base = cfg
        self._color = tuple(cfg.dot_color)
        self.size.setValue(int(cfg.dot_size))
        self.opacity.setValue(cfg.dot_opacity)
        self.deadzone.setValue(int(round(cfg.deadzone)))
        self.min_cutoff.setValue(cfg.min_cutoff)
        self.beta.setValue(cfg.beta)
        self.pose_margin.setValue(int(round(cfg.pose_margin)))
        self.offscreen.setValue(cfg.offscreen_margin * 100.0)
        self.fade_ms.setValue(int(cfg.fade_ms))
        self.grid_cols.setValue(int(cfg.grid_cols))
        self.grid_rows.setValue(int(cfg.grid_rows))
        self.snapshots.setChecked(bool(cfg.snapshots_enabled))
        self.retention.setValue(int(cfg.snapshot_retention_days))
        self.burst.setValue(int(cfg.snapshot_burst))
        self.alarm.setChecked(bool(cfg.alarm_enabled))
        self.alarm_min.setValue(int(round(cfg.alarm_off_screen_min)))
        self._apply_swatch()
        self._loading = False

    def current_config(self) -> OverlayConfig:
        return replace(
            self._base,           # preserve fields not exposed in the panel
            dot_size=int(self.size.value()),
            dot_opacity=float(self.opacity.value()),
            dot_color=self._color,
            deadzone=float(self.deadzone.value()),
            min_cutoff=float(self.min_cutoff.value()),
            beta=float(self.beta.value()),
            pose_margin=float(self.pose_margin.value()),
            offscreen_margin=float(self.offscreen.value()) / 100.0,
            fade_ms=int(self.fade_ms.value()),
            grid_cols=int(self.grid_cols.value()),
            grid_rows=int(self.grid_rows.value()),
            snapshots_enabled=bool(self.snapshots.isChecked()),
            snapshot_retention_days=int(self.retention.value()),
            snapshot_burst=int(self.burst.value()),
            alarm_enabled=bool(self.alarm.isChecked()),
            alarm_off_screen_min=float(self.alarm_min.value()))

    # --- slots -------------------------------------------------------------
    def _on_change(self) -> None:
        if not self._loading:
            self.configChanged.emit(self.current_config())

    def _pick_color(self) -> None:
        r, g, b = self._color
        chosen = QtWidgets.QColorDialog.getColor(
            QtGui.QColor(r, g, b), self, "Color del cursor")
        if chosen.isValid():
            self._color = (chosen.red(), chosen.green(), chosen.blue())
            self._apply_swatch()
            self._on_change()

    def _restore_defaults(self) -> None:
        self.set_from_config(DEFAULTS)
        self._on_change()
