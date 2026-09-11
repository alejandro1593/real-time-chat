import { useState } from 'react';

const initialUserIds = [];

export default function CreateGroup({ onCancel, onCreate, existingUsers }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(initialUserIds);
  const [attempted, setAttempted] = useState(false);

  function toggle(userId) {
    setSelected((s) =>
      s.includes(userId) ? s.filter((x) => x !== userId) : [...s, userId]
    );
  }

  function submit(e) {
    e.preventDefault();
    if (!name.trim() || selected.length === 0) {
      setAttempted(true);
      return;
    }
    onCreate(name.trim(), selected);
  }

  const hint =
    !name.trim() && !selected.length
      ? 'Escribe un nombre y selecciona al menos un miembro.'
      : !name.trim()
        ? 'Escribe un nombre para el grupo.'
        : selected.length === 0
          ? 'Selecciona al menos un miembro.'
          : null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-group" onClick={(e) => e.stopPropagation()}>
        <h3>Crear grupo</h3>
        <form onSubmit={submit}>
          <input
            placeholder="Nombre del grupo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="group-members-list">
            {existingUsers.length === 0 && <p className="muted">No hay otros usuarios para añadir.</p>}
            {existingUsers.map((u) => (
              <label key={u.id} className="group-member">
                <div className="avatar avatar-sm">{u.username[0]?.toUpperCase()}</div>
                <span>{u.username}</span>
                <input
                  type="checkbox"
                  checked={selected.includes(u.id)}
                  onChange={() => toggle(u.id)}
                />
              </label>
            ))}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
            <button type="submit">Crear</button>
          </div>
          {attempted && hint && <p className="form-hint">⚠ {hint}</p>}
        </form>
      </div>
    </div>
  );
}