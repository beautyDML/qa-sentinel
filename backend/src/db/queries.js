const pool = require("./index");

async function createScan(scan) {
  const query = `
    INSERT INTO scans(id,url,status,modules)
    VALUES($1,$2,$3,$4)
    RETURNING *;
  `;

  const values = [
    scan.id,
    scan.url,
    scan.status,
    JSON.stringify(scan.modules)
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}

async function updateScan(id, updates) {
  const query = `
    UPDATE scans
    SET status=$1,
        results=$2,
        health_score=$3
    WHERE id=$4
    RETURNING *;
  `;

  const values = [
    updates.status,
    updates.results,
    updates.health_score,
    id
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}

async function getScanById(id) {
  const result = await pool.query(
    "SELECT * FROM scans WHERE id=$1",
    [id]
  );

  return result.rows[0];
}

async function getHistory() {
  const result = await pool.query(
    "SELECT * FROM scans ORDER BY created_at DESC LIMIT 20"
  );

  return result.rows;
}

async function deleteScan(id) {
  await pool.query(
    "DELETE FROM scans WHERE id=$1",
    [id]
  );
}

module.exports = {
  createScan,
  updateScan,
  getScanById,
  getHistory,
  deleteScan
};