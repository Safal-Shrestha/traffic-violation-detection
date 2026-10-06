import { useEffect, useMemo, useState } from 'react'
import {ShieldCheck,UserCog,Users as UsersIcon,UserPlus} from 'lucide-react'

import UserStatCard from '../components/users/UserStatCard'
import UserFilters from '../components/users/UserFilters'
import UserTable from '../components/users/UserTable'
import EditUserModal from '../components/users/EditUserModal'
// import DeleteUserModal from '../components/users/DeleteUserModal'
import AddUserModal from '../components/users/AddUserModal'

import { createUser,getUsersData } from '../services/usersService'
import type { CreateUserRequest, User, UserRole, UsersData } from '../types/users'

import '../css/users.css'

import { useAuth } from '../context/useAuth'

function Users() {
  const { user } = useAuth()
  const isAdministrator = user?.role === 'ADMIN'

  const [data, setData] = useState<UsersData | null>(null)

  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')

  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  // const [deletingUser, setDeletingUser] = useState<User | null>(null)

  useEffect(() => {
    getUsersData().then(setData)
  }, [])

  const filteredUsers = useMemo(() => {
    if (!data) {
      return []
    }

    const normalizedSearch = search.toLowerCase().trim()

    return data.users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.badge_number.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch)

      const matchesRole =
        role === 'all' || user.role === role

      return matchesSearch && matchesRole
    })
  }, [data, search, role])

  if (!data) {
    return (
      <div className="users-loading">
        Loading users...
      </div>
    )
  }

  const totalUsers = data.users.length

  const administrators = data.users.filter(
    (user) => user.role === 'ADMIN',
  ).length

  const officers = data.users.filter(
    (user) => user.role === 'OFFICER',
  ).length

  const handleEditUser = (user: User) => {
    setEditingUser(user)
  }

  const handleSaveUser = (updatedUser: User) => {
    setData((currentData) => {
      if (!currentData) {
        return currentData
      }

      return {
        ...currentData,
        users: currentData.users.map((user) =>
          user.id === updatedUser.id ? updatedUser : user,
        ),
      }
    })

    setEditingUser(null)
  }

  // const handleDeleteUser = (user: User) => {
  //   setDeletingUser(user)
  // }

  // const handleConfirmDelete = () => {
  //   if (!deletingUser) {
  //     return
  //   }

  //   setData((currentData) => {
  //     if (!currentData) {
  //       return currentData
  //     }

  //     return {
  //       ...currentData,
  //       users: currentData.users.filter(
  //         (user) => user.id !== deletingUser.id,
  //       ),
  //     }
  //   })

  //   setDeletingUser(null)
  // }

  const handleCreateUser = async (
    userData: CreateUserRequest,
  ) => {
    const newUser = await createUser(userData)

    setData((currentData) => {
      if (!currentData) {
        return currentData
      }

      return {
        ...currentData,
        users: [...currentData.users, newUser],
      }
    })
  }

  return (
    <div className="users-page">
      <div className="users-stats">
        <UserStatCard
          title="Total Users"
          value={String(totalUsers)}
          description="Registered users"
          icon={<UsersIcon size={20} />}
        />

        <UserStatCard
          title="Administrators"
          value={String(administrators)}
          description="System administrators"
          icon={<UserCog size={20} />}
        />

        <UserStatCard
          title="Officers"
          value={String(officers)}
          description="Traffic officers"
          icon={<ShieldCheck size={20} />}
        />
      </div>

      <section className="users-content">
        <div className="users-content-header">
          <div>
            <h2>All Users</h2>
            <p>
              {filteredUsers.length} user
              {filteredUsers.length !== 1 ? 's' : ''} found
            </p>
          </div>

          {isAdministrator && (
            <button
              className="users-add-button"
              type="button"
              onClick={() => setIsAddUserOpen(true)}
            >
              <UserPlus size={17} />
              Add User
            </button>
          )}
        </div>

        <UserFilters
          search={search}
          role={role}
          onSearchChange={setSearch}
          onRoleChange={setRole}
        />

        <UserTable
          users={filteredUsers}
          onEdit={handleEditUser}
        />
      </section>

      {isAddUserOpen && (
        <AddUserModal
          onClose={() => setIsAddUserOpen(false)}
          onSave={handleCreateUser}
        />
      )}    

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveUser}
        />
      )}

      {/* {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onConfirm={handleConfirmDelete}
        />
      )} */}
    </div>
  )
}

export default Users