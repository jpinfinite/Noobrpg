---
name: game-security-auditor
description: Audita códigos e protocolos contra vulnerabilidades do OWASP Game Security, duplicações de itens, speedhacks, bypass de colisão e manipulações no cliente.
---

# Skill: Game Security Auditor

## Objetivo
Identificar e neutralizar falhas de segurança, explorações de economia e trapaças de cliente no NoobRPG.

## Foco de Auditoria e Testes
1. **Zero Client Trust:** Verificar se nenhum endpoint ou manipulador de pacote aceita valores arbitrários de dano, vida, saldo de gold ou itens do cliente.
2. **Race Conditions no Mercado:** Garantir que compras concorrentes usem bloqueio pessimista (`SELECT FOR UPDATE`) para evitar venda dupla do mesmo item.
3. **Restrições de Integridade no Banco:** Exigir `CHECK (gold >= 0)` em todas as tabelas contábeis.
4. **Proteção Anti-Speedhack:** Testar o limitador de distância por tick do servidor.
5. **Autenticação Segura:** Validar Argon2id/bcrypt para hashes de senhas e JWTs curtos com cookies HTTP-Only e SameSite=Strict.
- Documentação de referência em [SECURITY.md](file:///d:/NoobRPG/docs/SECURITY.md).
