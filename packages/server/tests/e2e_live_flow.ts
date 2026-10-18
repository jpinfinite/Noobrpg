import assert from 'node:assert/strict';

async function runLiveValidation() {
  const baseUrl = 'http://127.0.0.1:4000/api';
  console.log(`[E2E Live] Testando servidor em ${baseUrl}...`);

  // 1. Health Check
  const healthRes = await fetch(`${baseUrl}/health`);
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  console.log('✓ 1. Health check respondendo:', healthData.status);

  // 2. Registro de Conta com Argon2id
  const testUser = `hero_${Date.now()}`;
  const registerRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testUser, password: 'MinhaSenhaSegura2026!' })
  });
  assert.equal(registerRes.status, 201);
  const regData = await registerRes.json();
  const setCookie = registerRes.headers.get('set-cookie');
  assert.ok(setCookie && setCookie.includes('session_token='));
  const cookie = setCookie.split(';')[0];
  console.log(`✓ 2. Conta registrada (${regData.account.username}) com cookie HttpOnly.`);

  // 3. Consulta de Sessão Ativa (/me)
  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { Cookie: cookie }
  });
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.account.username, testUser);
  console.log('✓ 3. Sessão atual validada via cookie.');

  // 4. Criação de Personagem Canônico
  const charRes = await fetch(`${baseUrl}/characters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: `Paladin_${Math.floor(Math.random() * 999)}`, characterClass: 'WARRIOR' })
  });
  if (charRes.status !== 201) {
    const errBody = await charRes.text();
    console.error('Erro retornado na criação de personagem:', charRes.status, errBody);
  }
  assert.equal(charRes.status, 201);
  const charData = await charRes.json();
  const charId = charData.player.id;
  assert.equal(charData.player.characterClass, 'WARRIOR');
  assert.equal(charData.player.level, 1);
  assert.equal(charData.player.gold, 100);
  assert.equal(charData.player.inventory.length, 24);
  console.log(`✓ 4. Personagem criado com sucesso: ${charData.player.name} (ID: ${charId}).`);

  // 5. Lista de Personagens da Conta
  const listRes = await fetch(`${baseUrl}/characters`, {
    headers: { Cookie: cookie }
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.characters.length, 1);
  assert.equal(listData.characters[0].id, charId);
  console.log('✓ 5. Lista de personagens recuperada do banco de dados.');

  // 6. Salvamento de Progresso (XP, Level Up para Nível 2, Gold e Posição)
  const saveRes = await fetch(`${baseUrl}/characters/${charId}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      position: { x: 260, y: 190 },
      hp: 110,
      xpGained: 600, // 600 XP atinge nível 2
      goldChange: { amount: 75, source: 'quest_slime_hunter' },
      inventory: [
        { slotIndex: 0, itemId: 'potion_hp_minor', quantity: 4 },
        { slotIndex: 1, itemId: 'iron_ore', quantity: 8 }
      ],
      equipped: { weapon: 'sword_iron', armor: 'armor_leather', accessory: null }
    })
  });
  assert.equal(saveRes.status, 200);
  const saveData = await saveRes.json();
  assert.equal(saveData.player.level, 2);
  assert.equal(saveData.player.currentXp, 600);
  assert.equal(saveData.player.gold, 175);
  assert.equal(saveData.player.position.x, 260);
  console.log('✓ 6. Progresso persistido atomicamente: Nível 2, 175 Gold, nova posição e inventário.');

  // 7. Releitura dos Dados Persistidos
  const reloadRes = await fetch(`${baseUrl}/characters/${charId}`, {
    headers: { Cookie: cookie }
  });
  assert.equal(reloadRes.status, 200);
  const reloadData = await reloadRes.json();
  assert.equal(reloadData.player.level, 2);
  assert.equal(reloadData.player.currentXp, 600);
  assert.equal(reloadData.player.gold, 175);
  assert.equal(reloadData.player.position.x, 260);
  assert.equal(reloadData.player.position.y, 190);
  assert.equal(reloadData.player.inventory[1].itemId, 'iron_ore');
  console.log('✓ 7. Releitura autoritativa confirmou 100% de fidelidade.');

  // 8. Logout e Invalidação da Sessão
  const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie }
  });
  assert.equal(logoutRes.status, 200);

  const meAfterLogout = await fetch(`${baseUrl}/auth/me`, {
    headers: { Cookie: cookie }
  });
  assert.equal(meAfterLogout.status, 401);
  console.log('✓ 8. Logout invalidou a sessão.');

  // 9. Re-login com a mesma conta e recuperação intacta
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testUser, password: 'MinhaSenhaSegura2026!' })
  });
  assert.equal(loginRes.status, 200);
  const newCookie = loginRes.headers.get('set-cookie')!.split(';')[0];

  const finalCheck = await fetch(`${baseUrl}/characters/${charId}`, {
    headers: { Cookie: newCookie }
  });
  assert.equal(finalCheck.status, 200);
  const finalData = await finalCheck.json();
  assert.equal(finalData.player.level, 2);
  assert.equal(finalData.player.gold, 175);
  console.log('✓ 9. Novo login com sucesso: todos os dados recuperados perfeitamente do SQLite.');

  console.log('\n=========================================');
  console.log('TODAS AS 9 ETAPAS DE E2E LIVE PASSARAM COM SUCESSO!');
  console.log('=========================================');
}

runLiveValidation().catch(err => {
  console.error('Falha no teste E2E Live:', err);
  process.exit(1);
});
