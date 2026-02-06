// Referencia de Mapeo de Base de Datos PIDE YA
// Basado en tu imagen:

// Tabla: clientes
// Suposición de columnas:
// - id (uuid/int)
// - nombre (text)
// - telefono (text)
// - ...

// Tabla: tarjeta_lealtad
// Suposición de columnas:
// - id (uuid)
// - cliente_id (fk -> clientes.id)
// - puntos_actuales (int)
// - nivel (text?)

// Tabla: movimientos
// Suposición de columnas:
// - id (uuid)
// - tarjeta_id (fk -> tarjeta_lealtad.id)
// - tipo_movimiento (text: 'compra', 'canje', etc)
// - puntos (int)
// - fecha (timestamp)

class DbConstants {
  static const String tableClientes = 'clientes';
  static const String tableTarjeta = 'tarjeta_lealtad';
  static const String tableMovimientos = 'movimientos';
  
  // Columnas Clientes
  static const String colClientId = 'id';
  static const String colClientName = 'nombre'; // Confirmar nombre exacto
  static const String colClientPhone = 'telefono'; // Confirmar nombre exacto

  // Columnas Tarjeta
  static const String colCardId = 'id';
  static const String colCardClientId = 'cliente_id';
  static const String colCardPoints = 'puntos_actuales'; // Confirmar

  // Columnas Movimientos
  static const String colMovId = 'id';
  static const String colMovCardId = 'tarjeta_id'; // Confirmar
  static const String colMovType = 'tipo_movimiento';
  static const String colMovPoints = 'puntos';
  static const String colMovDate = 'created_at'; // Confirmar si es created_at o fecha
}
